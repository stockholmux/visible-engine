const 
  EventEmitter2 = require('eventemitter2').EventEmitter2,
  evs = new EventEmitter2( {
    wildcard: true
  }),
  cuid = require('cuid');

function ve(eventResponse,opts) {
  let 
    watching = {};
  opts = opts ? opts : {};

  return {
    eventResponse : eventResponse,
    addWatch : function(id) {
      watching[id] = true;
      evs.on(id+'.*',eventResponse)
    },
    removeWatch : function(id) {
      watching[id] = false;
      evs.off(id+'.*',eventResponse)
    },
    client : function(passedClient,sessionId) {
      let handler = {
        get : function(target,name) {
          return function() {
            if (passedClient[name]) {
              let argsArr = Array.from(arguments);
              if (watching[sessionId]) {
                
                let cb = argsArr[argsArr.length-1];
                let unique;
                if (opts.uniqueId) { unique = cuid(); } 
                if (typeof cb === 'function') {
                  argsArr[argsArr.length-1] = function() {
                    evs.emit(sessionId+'.'+name,name,argsArr,unique);
                    cb(...Array.from(arguments));
                  }
                } else {
                  argsArr.push(()=> {  evs.emit(sessionId+'.'+name,name,argsArr, unique); });
                }
                
                passedClient[name](...argsArr);
              } else {
                passedClient[name](...argsArr);
              }
            } else {
              console.log('Error',target, name);
            }
          }
        }
      }
      return new Proxy({}, handler);
    }
  }
}


module.exports = {
  createEngine  : ve,

  eventResponse : {
    consoleLog    : (redisCmd, redisArgs) => {
      console.log('ran',redisCmd, redisArgs);
    }
  },

  websocket       : {
    init            : function() {
      let websocketEmitter = new EventEmitter2({
        wildcard: true
      });

      return {
        expressWs : function(ws, req) {
          websocketEmitter.onAny(function(redisCmd,redisArgs,unique) {
            if (ws.readyState === 1) {
              if (typeof redisArgs[redisArgs.length-1] === 'function') {
                redisArgs.pop();
              }
              let payload = {
                command : redisCmd,
                arguments : redisArgs
              }
              if (unique) {
                payload.unique = unique;
              }
              ws.send(JSON.stringify(payload));
            }
          });
        },
        eventResponse : function(redisCmd, redisArgs, unique) {
          websocketEmitter.emit(redisCmd,redisArgs, unique)
        }
      }
    }
  }
}