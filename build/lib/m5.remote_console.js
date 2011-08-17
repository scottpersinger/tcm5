M5.remote = (function() {
  var remote_key = null;
  var errorCount = 0;
  var cmd_interval;
  var res_interval;
  
  function remote_send(message) {
    $.post('send_command__/' + remote_key, {command: message}, function(reply) {
      M5.simulator.debug(html_escape(reply));      
    }, 'text')
  }

  function clear_local_storage() {
    if (typeof(SimpleStorage) == "object") {
      SimpleStorage.db.tables(function(tables) {
        $.each(tables, function() {
          console.log("Dropping: " +this);
          SimpleStorage.db.drop_table(this);
        });
      });
    }
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      keys.push(localStorage.key(i));
    }
    $.each(keys, function() { 
      console.log("Removing localStorage: " + this);
      localStorage.removeItem(this) 
    });
      
    return "storage cleared";
  }
  
  function remote_command(command) {
    remote_send(M5.settings.app_name + ":" + command);
  }
  
  function run_remote_command(command) {
    var m;
    if (m = command.match(/([\w_\.]+):(.*)/)) {
      return eval(m[2]);
    } else if (m = command.match(/#remote#(.*)/)) {
      dispatch_direct_command(m[1]);
    }
  }
  
  function dispatch_direct_command(command) {
    if (command == "close") {
      console.log("Closing remote connection");
      remote_key = null;
      cmd_interval.cancel();
      res_interval.cancel();
    }
  }
  
  function poll_commands() {
    if (!remote_key) {
      console.log("Abort poll_commands, key is null")
      return;
    }
    console.log("Polling for commands...");
    $.get('get_command__/' + remote_key, function(command) {
      if (command != "") {
        console.log("Remote command: " + command);
        var res;
        try {
          res = M5.util.inspect(run_remote_command(command));
        } catch (e) {
          res = "Error: " + e.message;
        }
        console.log("Returning response");
        console.log("setTimeout for poll_commands");
      }
      setTimeout(poll_commands, 250);
      $.post('send_response__/' + remote_key, {response: res});
    }, 'text').error(function() {
      errorCount += 1;
      
      if (errorCount < 10) {
        setTimeout(remote_receive_connect, 2000);
      }
    });
  }

  function html_escape(val) {
    return val.replace(/</g,"&lt;").replace(/>/g,'&gt;');
  }
  
  function remote_command_connect(app_name) {
    $.post('remote_connect__/' + app_name, function(result) {
      remote_key = result.key;
      console.log("Connected to remote console as: " + remote_key);
    }, 'json');
  }

  function remote_receive_connect(app_name) {
    $.post('remote_connect__/' + app_name, function(result) {
      remote_key = result.key;
      console.log("Connected to remote console as: " + remote_key);
    }, 'json');
    
    cmd_interval = setTimeout(poll_commands, 1000);
  }

  function remote_close() {
    remote_key = null;
  }
  
  return {
    command: remote_command,
    connect_send: remote_command_connect,
    connect_receive: remote_receive_connect,
    close: remote_close
  }
}());
