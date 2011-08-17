/*
 @@@@@@@@@@@@@>      @@@@@@@@@@>
 @>    @@@>  @>      @>         
 @>     @>   @>      @@@@@@@@@@>
 @>          @>               @>
 @>          @>               @>
 @>          @>      @@@@@@@@@>       

 (c) Scott Persinger 2011. See LICENSE.txt for license.
 
 M5 support
*/
M5.require('jQuery');

/* System class additions */
Storage.prototype.setObject = function(key, value) {
    this.setItem(key, JSON.stringify(value));
}

Storage.prototype.getObject = function(key, demarshal) {
    var result = JSON.parse(this.getItem(key));
    if (demarshal && result && typeof(result.length) != "undefined") {
      result = $.map(result, demarshal);
    }
    return result;
}

Date.prototype.datesEqual = function(other) {
  if (other && typeof(other) == 'object') {
    return this.toDateString() == other.toDateString();
  } else {
    return false;
  }
}

String.prototype.trim = function() {
  return jQuery.trim(this);
}
/** M5.util defines a set of utility functions.
 */
 
M5.util = (function() {
  var benchmarks = [];
  
  return {
    benchmark: benchmark,
    bench_start: bench_start,
    bench_end: bench_end,
    function_source: function_source,
    get_cookie: get_cookie,
    hash: hash,
    inspect: inspect,
    set_cookie: set_cookie
  }
  
  /**#@+
     @public
     @memberOf M5.util#
  */
  
  /** Retrieve the body of a function as text */
  function function_source(f) {
    var lines = f.toString().split("\n");
    return lines.splice(1, lines.length-2).join("\n");
  }
  
  /** Set a cookie value. */
  function set_cookie(name, value) {
    document.cookie = name + "=" + escape(value + '');
  }
  
  /** Get a cookie value, or null. */
  function get_cookie(name) {
    parts = document.cookie.split("; ");
    var m;
    var res = null;
    $.each(parts, function(index, val) {
      if (m = val.match(new RegExp("^" + name + "=(.*)"))) {
        res = m[1];
      }
    });
    return res ? unescape(res) : null;
  }
  
  function delete_cookie(name) {
    document.cookie = name + "=";
  }
  
  /** Mark the time that event 'key' starts. */
  function bench_start(key) {
    benchmarks[key] = new Date();
  }

  /** Report the time since bench_start(key) was called. */
  function bench_end(key) {
    var start;
    if (start = benchmarks[key]) {
      console.log("Benchmark == " + key + "  == " + ((new Date() - start)/1000) );
    }  
  }

  /** Report the time required to execute function f. */
  function benchmark(label, f) {
    var start = new Date();
    f();
    console.log("Benchmark == " + label + "  == " + ((new Date() - start)/1000) );
  }

  /** Return a hash generated from 'key' */
  function hash(key, tableSize) {
    tableSize = tableSize || 99999999;
    var s = key;

    var b = 27183, h = 0, a = 31415;

    if (tableSize > 1) {
      for (i = 0; i < s.length; i++) {
        h = (a * h + s[i].charCodeAt()) % tableSize;
        a = ((a % tableSize) * (b % tableSize)) % (tableSize);
      }
    }

    return h;
  }
  
  function inspect(obj, level) {
    level = level || 0;
    if (level > 1) {
      return '';
    }
    if (obj instanceof jQuery || jQuery.isArray(obj)) {
      var res = [];
      for (var i = 0; i < obj.length; i++) {
        res.push(inspect(obj[i], level+1));
      }
      return "[" + res.join(", ") + "]";
    } else if (obj instanceof Element) {
      var res = "<" + obj.tagName;
      for (var i = 0; i < obj.attributes.length; i++) {
        res = res + " " + obj.attributes[i].name + '="' + obj.attributes[i].value + '" ';
      }
      res = res + " />";
      return res;
    }
    if (!obj) {
      return 'null';
    } else if (typeof(obj) == "object") {
      var res = [];
      for (k in obj) {
        res.push(k + ": " + inspect(obj[k], level+1));
      }
      return "{" + res.join(", ") + "}";
    } else {
      return obj + "";
    }
  }
})();

/** Interpolates the first argument string looking for {{identifier}} and %@ patterns. Values
  * can be provided either as a hash, like:
  *  M5.format("Hello {{first_name}} {{last_name}}", {first_name: 'scott', last_name: 'persinger'})
  * or by position, like:
  *  M5.format("Hello %@ %@", 'scott', 'persinger')
  */
M5.format = function(fmt) {
  var result = fmt;
  if ($.isPlainObject(arguments[1])) {
    $.each(arguments[1], function(key, val) {
      result = result.replace(new RegExp("{{\s*" + key + "\s*}}"), val);
    });
  } else {
    for (var i = 1; i < arguments.length; i++) {
      result = result.replace(/%@/, arguments[i]).replace(/{{\s*\w+\s*}}/,arguments[i]);
    };
  }
  return result;
}
