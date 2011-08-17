/*
 @@@@@@@@@@@@@>      @@@@@@@@@@>
 @>    @@@>  @>      @>         
 @>     @>   @>      @@@@@@@@@@>
 @>          @>               @>
 @>          @>               @>
 @>          @>      @@@@@@@@@>       
 
 (c) Scott Persinger 2011. See LICENSE.txt for license.
 
 M5 simulator
 
 Set M5.settings.no_sim_panel = true to prevent display of a control panel.
*/



M5.onTouchReady(function() {
  var deviceSet;
  var currentDevice;
  var inLandscape = false;
  
  function debug(msg) {
    if (msg instanceof Array) {
        msg = msg.join(" ");
    }
    $('#m5-simpanel .m5-log').append(msg + "\n");
  }
  M5.addConsoleListener(debug);
  
  function loadBig() {
    $('head').append("<style>#m5-simpanel {float:right;width:300px;height:500px;border:2px solid #CCC;background:#EEE;" +
      "overflow:hidden;padding:10px 10px 10px 0px;position:relative;line-height:21px;}"+
      "\nbody:before {position:absolute;top:0%;left:0;z-index:-1;content:url(lib/m5/assets/iphone.png);" + 
      "-webkit-transform:rotate(0deg);-webkit-transform-origin:0% 0%};" +
      "</style>");
    setTimeout(function() {
      console.log("Setting margin");
      //$(document.body).css('background', 'url(lib/m5/assets/iphone.png) no-repeat');
      //$(document.body).css('background-color', '#FFF');
    }, 200);
    var leftMargin = 28;
    var topMargin = 77;
    var height = $(window).height()
    if ($('#jqt').length > 0) {
      $('#jqt').css({width:(320), height:(480), 'margin-left' :'26px', 'margin-top': '77px', overflow:'hidden',float:'left',position:'relative'});
    } else {
      if ($('body > div').length > 1) {
        // Jam in a container to size everything
        $('body > div').wrapAll('<div />');
        $.mobile.pageContainer = $('body > div:first');
      }
      $('body').css('margin', '0');
      $('body > div:first').css({width:(320), height:(480), 'margin-left' :'27px', 'margin-top': '78px', 'overflow-x':'hidden',
        'overflow-y':'scroll','float':'left',position:'relative'});
      $('body').css('height', (77+480+77) + 'px');
    }
    $(document.body).append(buildIframePanel());
    
    var onmessage = function(e) { 
      var data = e.data; 
      var origin = e.origin; 
      var args = data.split(",");
      var command = args[0];
      args.shift();
      
      if (command == "device") {
        loadDevice(args[0]);
      } else if (command == "landscape") {
        setLandscape(args[0]);
      }
    }; 

    window.addEventListener('message', onmessage, false); 
    
    loadDevices(function(devices) {
      deviceSet = devices;
    });
  }
  
  function loadDevice(name) {
    if (deviceSet[name]) {
      currentDevice = deviceSet[name];
      $('head').append("<style>body:before {content:url(lib/m5/assets/" + currentDevice.image + ");}</style>");
      $('body > div:first').css({'margin-left':currentDevice.contentLeft +'px','margin-top':currentDevice.contentTop + 'px',
        width:currentDevice.contentWidth, height:currentDevice.contentHeight});
      setLandscape(inLandscape + '');
    }
  }
  
  function setLandscape(flag) {
    var ss;
    if (flag == "true") {
      inLandscape = true;
      ss = "body:before {top:" + currentDevice.width + "px;-webkit-transform:rotate(-90deg);-webkit-transform-origin:0% 0%};";
    } else {
      inLandscape = false;
      ss = "body:before {top:0px;-webkit-transform:rotate(0deg);-webkit-transform-origin:0% 0%};";
    }
    $('head').append("<style>" + ss + "</style>");
    setTimeout(function() {
      if (flag == "true") {
        $('body > div:first').css({'margin-top':currentDevice.contentLeft + 'px', 'margin-left':currentDevice.contentTop + 'px',
          width:currentDevice.contentHeight, height:currentDevice.contentWidth});
      } else {
        $('body > div:first').css({'margin-left':currentDevice.contentLeft +'px','margin-top':currentDevice.contentTop + 'px',
          width:currentDevice.contentWidth, height:currentDevice.contentHeight});
      }
    }, 0);
  }
  
  function buildIframePanel() {
    var height = $(window).height() - 50;
    return '<div id="m5-simpanel" style="width:700px;height:95%;padding:0"><iframe src="http://' + window.location.host + '/sim__" style="width:100%;height:100%"></iframe>';
  }
  
  function loadInline() {
    $('#jqt').append('<div id="m5-sim" style=""><div class="toolbar"><h1>Debug</h1><a class="button goback" href="#">Close</a></div>' +
      buildInlinePanel() + '</div>');
  }
  
  function loadDevices(callback) {
    $.get('lib/assets/devices.json', function(devices) {
      devices = JSON.parse(devices);
      var deviceSet = {}
      $.each(devices, function(idx, item) {
        deviceSet[item.name] = item;
      });
      callback(deviceSet);
    }, 'text');
  }  
  
  function buildInlinePanel() {  
    return '<div><div id="m5-simpanel">' +
      '<div>Environment: ' + M5.env + '</div>' +
      '<div>UserAgent: ' + navigator.userAgent + '</div>' +
      '<button class="m5-reload touch">Reload App</button><button class="m5-clear">Clear Log</button><br />' + 
      '<button class="m5-update touch">Update App Cache</button><br />' + 
      '<button class="m5-reset touch">Clear Local Storage</button><br />' +
      '<button class="m5-test1 touch">Test iframe</button><br />' +
      '<div class="m5-header">Log</div>' +
      '<textarea class="m5-log touch"></textarea>' +
      '</div></div>';
  }


  // Immediate code

  if (!M5.settings.no_sim_panel) {
    if (M5.settings.inline_sim || M5.iPhone || M5.Android) {
      loadInline();
    } else {
      loadBig();
    }
  }
    
  $('#m5-simpanel .m5-reload').bind('click touchstart', function() {
    alert("Reloading app");
    M5.setUpdateListener(function() {
      M5.silent_update(false);
      window.location.reload();
    });
    M5.silent_update(true);
    window.applicationCache.update();
  });
  $('#m5-simpanel .m5-update').click(function() {
    window.applicationCache.update();
  });
  $('#m5-simpanel .m5-clear').bind('click touchstart', function() {
    $('#m5-simpanel .m5-log').html('');
  });
  $('#m5-simpanel .m5-reset').click(function() {
    if (typeof(SimpleStorage) == "object") {
      SimpleStorage.db.tables(function(tables) {
        $.each(tables, function() {
          debug("Dropping: " +this);
          SimpleStorage.db.drop_table(this);
        });
      });
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        keys.push(localStorage.key(i));
      }
      $.each(keys, function() { 
        debug("Removing localStorage: " + this);
        localStorage.removeItem(this) 
      });
      
    } else {
      debug("Please load SimpleStorage module");
    }
  });
  
  $('#m5-simpanel .m5-test1').click(function () {
    $('#fullstory').append('<iframe style="height:400px" src="http://www.google.com/" />');
  });
  
  function app_key() {
    return remote_key;
  }
  
  M5.simulator = {
    app_key: app_key,
    debug: debug,
    load_devices: loadDevices
  }
});
