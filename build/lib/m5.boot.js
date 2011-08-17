/*
 @@@@@@@@@@@@@>      @@@@@@@@@@>
 @>    @@@>  @>      @>         
 @>     @>   @>      @@@@@@@@@@>
 @>          @>               @>
 @>          @>               @>
 @>          @>      @@@@@@@@@>       

 (c) Scott Persinger 2011. See LICENSE.txt for license.
  
  Boot script for M5 apps.

    M5.addTouchReady - Register callback to run when touch events are available
    M5.silent_update(flag) => call with true to update cached app without prompting user
    M5.settings => hash of arbitrary app settings
    M5.orig_console => holds the native value of the 'console' object
    M5.setUpdateListener(callback) => Callback to invoke after app is updated
    M5.addConsoleListener(callback) => Register a callback to receive console.log calls
    M5.env => 'development|production|testing'
    M5.production => true if in production environment
    M5.development => true if in production environment
    M5.testing => true if in production environment
    M5.iPhone => true if running on an iPhone
    M5.Android => true if running on an Android device
    M5.require(moduleName) => Indicate dependency on another code module
*/

M5 = (function() {
  var cacheStatusValues = [];
  cacheStatusValues[0] = 'uncached';
  cacheStatusValues[1] = 'idle';
  cacheStatusValues[2] = 'checking';
  cacheStatusValues[3] = 'downloading';
  cacheStatusValues[4] = 'updateready';
  cacheStatusValues[5] = 'obsolete';
  var updateListener;
  var silent_update;
  var log_handlers = [];
  var prod_env = true;
  var dev_env = false;
  var test_env = false;
  var environment = 'production';
  var touchReadyCallbacks = [];
  var touchReadyRan = false;
  var config = {};
  var run_as_in_browser = false;
  var readyTrycount = 0;
  
  function set_env(val) {
    environment = val;
    M5.env = val;
    
    if (environment == 'development') {
      dev_env = true;
      prod_env = false;
      test_env = false;
    } else if (environment == 'testing') {
      dev_env = true;
      prod_env = false;
      test_env = true;
    } else {
      dev_env = false;
      prod_env = true;
      test_env = false;
    }
  }
  
  function setUpdateListener(callback) {
    updateListener = callback;
  }
  
  function silent_update(flag) {
    silent_update = flag;
  }
  
  function m5_log() {
    var args = Array.prototype.slice.call(arguments);  
    M5.orig_console.log.apply(M5.orig_console, args);
    $.each(log_handlers, function() {
      this(args);
    });
  }
  
  function addConsoleListener(callback) {
    log_handlers.push(callback);
  }
  
  /** Utility for specifying dependencies in your code to other modules. Use: M5.require('SimpleStorage'). */
  function require(module) {
    if (eval("typeof(" + module + ")") == "undefined") {
      var stack = null;
      try { throw Error() } catch(ex) { stack = ex.stack };
      
      alert("Missing required module '" + module + "' from " + stack);
    }
  }
  
  function addTouchReady(callback) {
    if (touchReadyRan) {
      //can go immediately
      callback();
    } else {
      touchReadyCallbacks.push(callback);
    }
  }
  
  function runTouchReadyCallbacks() {
    console.log("Touch ready callbacks");
    readyTrycount++;
    if (!touchReadyRan) {
      if ($.mobile || $.fn.tap || run_as_in_browser) {
        touchReadyRan = true;
        $.each(touchReadyCallbacks, function() {this()});
      } else {
        if (readyTrycount < 10) {
          setTimeout(runTouchReadyCallbacks, 20);
        }
      }
    }
  }
  
  function assume_browser(flag) {
    run_as_in_browser = flag;
  }
  
  if ($.mobile) {
    console.log("JQMobile pagecreate handler")
    $(":jqmData(role='page'):first").live('pagecreate', runTouchReadyCallbacks);
  } else {
    $(document).bind('ready', runTouchReadyCallbacks);
  }
  
  window.applicationCache.addEventListener('updateready', function(e){
        var cache = window.applicationCache;
        
        // Don't perform "swap" if this is the first cache
        if (cacheStatusValues[cache.status] != 'idle') {
            if (silent_update || confirm("Update the application?")) {
              cache.swapCache();
              console.log('Swapped/updated the Cache Manifest.');
              if (updateListener) {
                updateListener();
              }
            }
        }
    }
  , false);

  return {
    iPhone: window.navigator.userAgent.match(/iPhone/),
    Android: window.navigator.userAgent.match(/Android/),
    setUpdateListener: setUpdateListener,
    silent_update: silent_update,
    m5_log: m5_log,
    orig_console: console,
    addConsoleListener: addConsoleListener,
    production: prod_env,
    development: dev_env,
    assume_browser: assume_browser,
    onTouchReady: addTouchReady,
    require: require,
    testing: test_env,
    set_env: set_env,
    env: environment,
    jqtouch_images: function() {return []},
    settings: {}
  }
})();
 
console = {log: M5.m5_log};

 