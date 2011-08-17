/*
 @@@@@@@@@@@@@>      @@@@@@@@@@>
 @>    @@@>  @>      @>         
 @>     @>   @>      @@@@@@@@@@>
 @>          @>               @>
 @>          @>               @>
 @>          @>      @@@@@@@@@>       

 (c) Scott Persinger 2011. See LICENSE.txt for license.
 
 SimpleStorage
 
*/

if (typeof(SimpleStorage) == 'undefined') {
  var SimpleStorage = {db:null};
}

/**
 * Provides a super simple, schema-less API for storing single-level Javascript objects
 * in the local Web Sql store.
 * @class Interface to the local Web Sql store.
 */
SimpleStorage = SimpleStorage || {};
 
SimpleStorage.connect = function(db_name, size, options, callback) /** @lends SimpleStorage */
{
  db_name = db_name || 'db1';
  size = size || (1024*1024*2);
  if (!callback) {
    callback = options;
    options = {};
  }
  options = options || {};
  var schemaDictionary = {};
  var DATE_SUFFIX = "__dte";
  
  // Database startup
  var db = openDatabase(db_name, '1.0', options.description, size);
  
  db.transaction(function (tx) {
    tx.executeSql('CREATE TABLE IF NOT EXISTS schema (table_name text, col_name text)', [], function() {
      SimpleStorage.db = make_facade();
      callback(SimpleStorage.db);
    });
  });
  
  function genericError(tx, err, sql) {
    sql = sql || '??';
    console.log("Error from sql: " + sql + ": " + err.message);
  }
  
  function executeSqlLog(tx, sql, args, callback, error_callback) {
    if (typeof(args) == "function") {
      callback = args;
      args = [];
    }
    args = args || [];
    var argLog = '';
    if (args.length > 0) {
      var logs = [];
      $.each(args, function() { logs.push(('' + this).substring(0,40)) });
      argLog = "(" + logs.join(",") + ")";
    }
    console.log(sql + ", args: " + argLog);
    tx.executeSql(sql, args, callback, error_callback || function(tx, err) {
      genericError(tx, err, sql);
    });
  }
  
  function reify_results(results, schema) {
    var objs = [];
    for (i = 0; i < results.rows.length; i++) {
      var obj = {};
      var row = results.rows.item(i);
      for (var k in row) {
        if (m = k.match("(.*)" + DATE_SUFFIX + '$')) {
          obj[m[1]] = new Date(row[k]);
        } else {
          obj[k] = row[k];
        }
      }
      objs.push(obj);
    }
    return objs;
  }
  
  function build_where_clause(options) {
    if (typeof(options) == "string") {
      return "WHERE " + options;
    } else if (options && typeof(options) == "object") {
      var cols = [];
      for (var k in options) {
        var val = options[k];
        if (typeof(val) == "string") {
          cols.push(k + "='" + val + "'");
        } else if (val instanceof Date) {
          cols.push(k + DATE_SUFFIX + "=" + val.getTime());
        } else {
          cols.push(k + '=' + val);
        }
        return "WHERE " + cols.join(" AND ");
      }
    } else {
      return "";
    }
  }

  function build_order_clause(options) {
    if (typeof(options) == "string") {
      return "ORDER BY " + options;
    } else if (options && typeof(options) == "object") {
      order_cols = [];
      for (var k in options) {
        if (options[k].match(/desc/i)) {
          order_cols.push(k + " DESC");
        } else {
          order_cols.push(k + " ASC");
        }
      }
      return "ORDER BY " + order_cols.join(",");
    } else {
      return "";
    }
  }
  
  function save_object(tx, table, schema, object, callback, error_callback) {
    var newCols = find_new_columns(schema, object);
    if (newCols) {
      executeSqlLog(tx, "ALTER TABLE " + table + " ADD " + newCols);
    }
    executeSqlLog(tx, "INSERT INTO " + table + " (" + schema.join(",") + ") VALUES ("
      + $.map(schema, function() {return '?'}).join(',') + ")", sql_values(schema, object), callback, error_callback);
  }
  
  /**#@+
     @public
     @memberOf SimpleStorage#
  */
  
  /** Run an aribitrary SQL command against the database. Callback is optional, will
    * receive the transcation and SQLResultSet object (tx,results).
    */
  function run_sql(sql, args, callback) {
    console.log(sql);
    callback = callback || function(tx, results) {
      for (i = 0; i < results.rows.length; i++) {
        var row = results.rows.item(i);
        var res = [];
        for (k in row) {
          res.push(k + "=" + row[k]);
        }
        console.log(res.join("; "));
      }
    }
    
    db.transaction(function (tx) {
      tx.executeSql(sql, args, callback, genericError);
    });
  }
  
  /** Select all the rows from the indicated table. Invokes callback with an array of
    * all rows converted into objects.
    * @argument options Can include 'where', 'order', and 'limit'. For the where clause, indicate
    * a string (eg. "id = 5") or a hash of cols and values.
    * For the order clause, you can indicate a single column name as a string, or a hash
    * of column names mapped to the keywords 'asc' or 'desc'.
    * 
    */
  function select_all(table, options, callback) {
    if (!callback && typeof(options) == "function") {
      callback = options;
      options = {};
    }
    options = options || {};
    
    retrieveSchema(table, null, function(schema) {
      if (schema) {
        db.transaction(function(tx) {
          var where = build_where_clause(options.where);
          var order = build_order_clause(options.order);
          var limit = options.limit ? ("LIMIT " + options.limit) : '';
          
          executeSqlLog(tx, "SELECT * FROM " + table + " " + where + " " + order + " " + limit, [], function(tx, results) {
            callback(reify_results(results, schema));
          }, function(tx, err) {
            // special hack to allow us to select from a table that doesn't exist yet
            if (err.message.match(/no such table/)) {
              callback([]);
            }
          });
        });
      } else {
        callback([]);
      }
    });
  }

  /** Saves one or more items to the indicated table. Items argument can be a single object
    * or an array of objects. Object properties will be mapped to table columns. Object properties
    * must be a storable type: number, string, date, boolean, or array of storable types (such
    * as an array of strings). Numbers will be mapped to db type REAL unless the property name
    * ends in 'id', in which case an INT column will be used.
    *
    * Tables will be created on demand if they don't exist, and the table schema will be derived
    * from the first element of the items array. If you pass an item with heretofore unknown
    * properties than new columns will be added to the table automatically. 
    */
  function save(table, items, callback, error_callback) {
    retrieveSchema(table, items, function(schema) {
      if ($.isArray(items)) {
        if (items.length == 0) {
          // nothing to save
          callback();
        } else {
          db.transaction(function(tx) {
            // Iteratively save all items, only invoke callback on the last one.
            $.each(items, function(index, value) {
              save_object(tx, table, schema, value, (index == items.length-1) ? callback : null, error_callback);
            });
          });  
        }
      } else {
        var item = items;
        db.transaction(function(tx) {
          save_object(tx, table, schema, item, callback, error_callback);
        });
      }
    });
  }
  
  /** Invokes the callback with an array of all known table names. */
  function tables(callback) {
    db.transaction(function (tx) {
      executeSqlLog(tx, "select distinct(table_name) from schema", function(tx, results) {
        var tables = [];
        for (i = 0; i < results.rows.length; i++) {
          var row = results.rows.item(i);
          tables.push(row.table_name);
        }
        callback(tables);      
      });
    });
  }
    
  /** Removes the indicated item from the indicated table. If the item has an 'id' property then it
    * will be removed by a query for that id. Otherwise the WHERE clause will be built with all
    * properties of the item.
    */
  function delete_item(table, item, callback) {
    db.transaction(function (tx) {
      var where;
      if (typeof(item) == "number") {
        item = {id: item};
      }
      if (item['id']) {
        executeSqlLog(tx, "DELETE FROM " + table + " WHERE id = ?", [item['id']], callback);
      } else {
        retrieveSchema(table, item, function(schema) {
          executeSqlLog(tx, "DELETE FROM " + table + " WHERE " + placeholders(schema), sql_values(schema,item), callback);
        });
      }
    });
  }
  
  /** Removes all rows from the indicated table.
    */
  function delete_all(table, callback) {
    db.transaction(function(tx) {
      executeSqlLog(tx, "DELETE FROM " + table, callback);
    });
  }
  
  function drop_table(table, callback) {
    db.transaction(function (tx) {
      executeSqlLog(tx, "DROP TABLE " + table);
      executeSqlLog(tx, "DELETE FROM schema WHERE table_name = '" + table + "'", callback);
    });
  }
  
  function dump_table(table) {
    select_all(table, function(rows) {
      $.each(rows, function() {
        var res = [];
        for (k in this) {
          var val = this[k];
          if (typeof(val) == "string") {
            val = val.substring(0,40);
            if (val.length < this[k].length) {
              val = val + "...";
            }
          }
          res.push(k + "=" + val);
        }
        console.log(res.join("; "));
      });
    });
  }
  
  function drop_index(table, cols, callback) {
    db.transaction(function (tx) {
      executeSqlLog(tx, "DROP INDEX " + make_index_name(table, cols), callback);
    });
  }
  
  /** Returns the total rows in the given table. */
  function count(table, callback) {
    db.transaction(function(tx) {
      executeSqlLog(tx, "select count(*) as count from " + table, function(tx, results) {
        if (callback) {
          callback(results.rows.item(0)['count']);
        } else {
          console.log(results.rows.item(0)['count']);
        }
      });
    });
  }
  
  /** Create an index on table, indexed on the indicated columns (may be a single value). Provide a
    * callback if you want to be notified after the index is added. Options can include {unique:true}
    * to create a unique index. Note that creating a unique index may fail if duplicate tuples of the
    * indicated columns are already present in the table. 
    */
  function create_index(table, cols, options, callback) {
    if (!callback && typeof(options) == "function") {
      callback = options;
      options = {};
    }
    if (!$.isArray(cols))
      cols = [cols];
    var indexName = make_index_name(table, cols);
      
    var unique = (options && options.unique) ? 'UNIQUE' : '';
    
    db.transaction(function (tx) {
      executeSqlLog(tx, "CREATE " + unique + " INDEX IF NOT EXISTS " + indexName + " ON " + table + "(" + cols.join(",") + ")", callback);
    })
  }
  
  function create_unique_index(table, cols, callback) {
    create_index(table, cols, {unique:true}, callback);
  }

  /** Return the database type name to use for the indicated value. Name is optional. Pass
    * a name ending in 'id' to get an INTEGER type.
    */
  function db_field_type(val, name) {
      if (typeof(val) == "number") {
        if (name && name.match(/id$/g)) {
          return "INTEGER";
        }
        return "REAL";
      } else if (typeof(val) == "string") {
        return "TEXT";
      } else if (typeof(val) == "boolean") {
        return "BOOL";
      } else if (val instanceof Date) {
        return "INTEGER";
      } else {
        return null;
      }
  }
  
  
  /**#@-*/
  
  function sql_values(schema, item) {
    var res = [];
    $.each(schema, function(index, key) {
      if (m = key.match("(.*)" + DATE_SUFFIX + "$")) {
        key = m[1];
      }
      var val = item[key];
      if (val instanceof Date) {
        val = val.getTime();
      }
      res.push(val);
    });
    return res;
  }
  
  function placeholders(schema) {
    return $.map(schema, function(k) {
      return k + " = ?"
    }).join(" AND ")
  }
  
  function find_new_columns(schema, item) {
    var newcols = [];
    var dbType;
    for (var k in item) {
      if (schema.indexOf(k) < 0 && schema.indexOf(k + DATE_SUFFIX) < 0 && (dbType = db_field_type(item[k], k)) ){
        newcols.push(k + " " + dbType);
      }
    }
    return newcols.length > 0 ? newcols.join(", ") : null;
  }
  
  function make_index_name(table, cols) {
    if (!$.isArray(cols))
      cols = [cols];
    return table + "_" + $.map(cols, function(col_name) {
      return col_name.substring(0,5);
    }).join("_") + "_idx";
  }
  
  function retrieveSchema(table, items, callback) {
    if ((schema = schemaDictionary[table])) {
      callback(schema);
    } else {
      db.transaction(function(tx) {
        executeSqlLog(tx, "SELECT * from schema where table_name = ?", [table], function(tx, results) {
          var schema = [];
          for (i = 0; i < results.rows.length; i++) {
            var row = results.rows.item(i);
            schema.push(row.col_name);
          }
          if (schema.length > 0) {
            schemaDictionary[table] = schema;
            callback(schema);
          } else if (schema.length == 0 && items) {
            // Create a new table, using an item as the model
            var item = items;
            if ($.isArray(items)) {
              if (items.length > 0) {
                item = items[0];
              } else {
                item = null;
              }
            }
            if (item) {
              var sql = "CREATE TABLE IF NOT EXISTS " + table + " ";
              var cols = ["id INTEGER PRIMARY KEY"];
              var schema = [];
              for (var k in item) {
                var dbType = db_field_type(item[k], k);
                if (item[k] instanceof Date) {
                  k = k + DATE_SUFFIX;
                }
                if (dbType) {
                  cols.push(k + " " + dbType);
                  schema.push(k);
                }
              }
              schemaDictionary[table] = schema;
              sql = sql + "(" + cols.join(", ") + ")";
              executeSqlLog(tx, sql, [], function(tx, results) {
                $.each(schema, function() {
                  executeSqlLog(tx, "INSERT INTO schema (table_name,col_name) VALUES (?,?)", [table,this]);
                });
                callback(schema);
              });
            }
          } else {
            callback(null);
          }
        })
      });
    }
  }
  
  function assert(expr, test) {
    if (expr) {
      console.log("[sucess] " + test);
    } else {
      console.log("[failed] " + test)
    }
  }
  
  function assert_equal(expect, result, test) {
    if ($.isArray(expect) && $.isArray(result)) {
      expect = expect.join(",");
      result = result.join(",");
    }
    if (result == expect) {
      console.log("[success] " + test);
    } else {
      console.log("[failed] " + test + " expected '" + expect + "' != '" + result + "'");
    }
  }
  
  function UNIT_TEST() {
    drop_table('test_posts', function() {
    
      assert_equal(["aaa","bbb","ccc"], sql_values(["a","b","c"], {a: "aaa", b: "bbb", c:"ccc"}), "sql_values");
      assert_equal("d TEXT", find_new_columns(["a","b","c"], {a: "aaa", b: "bbb", c:"ccc", d: "ddd"}), "find_new_columns");
      assert_equal("REAL", db_field_type(55), "db_field_type REAL");
      assert_equal("INTEGER", db_field_type(new Date()), "db_field_type DATE");
      assert_equal("TEXT", db_field_type("foo"), "db_field_type TEXT");
      assert_equal("BOOL", db_field_type(true), "db_field_type BOOL");
      assert_equal("INTEGER", db_field_type(100,"order_id"), "db_field_type INTEGER");
    
      post = {title: "A very good read", pubDate: (new Date()), url: "http://google.com"};
    
      test1();
    
      function test1() {
        console.log("test 1");
        save('test_posts', post, function() {
          select_all('test_posts', function(results) {
            console.log("selected " + results.length + " rows");
            row = results[0];
            assert(row, "post inserted");
            assert(row.pubDate instanceof Date, "Date demarshaled properly");
            $.each(results, function() {
              console.log(this);
            });
            test2();
          });
        });
      }
    
      function test2() {
        console.log("test 2");
        create_unique_index('test_posts', "url");
        save('test_posts', post, function() {
          assert(false, "Post should not have saved"); 
        }, function() {
          assert(true, "Unique index prevented save");
          test3();
        });
      }

      function test3() {
        console.log("test 3");
        drop_index('test_posts', "url", function() {
          save('test_posts', post, function() { 
            assert(true, "Post should have saved without index"); 
            test4();
          });
        });
      }
    
      function test4() {
        console.log("test 4");
        count('test_posts', function(start_count) {
          posts = [{title : "post 1", url :"url1"}, {title:"post 2", url:"url2"}, {title:"post 3", url:"url3"}];
          save('test_posts', posts, function() {
            count('test_posts', function(end_count) {
              assert_equal(3, end_count - start_count, "multiple insert worked");
            });
          });
        });
      }
    });
  }
  
  function make_facade() {
    return {
      count: count,
      create_index: create_index,
      find_new_columns: find_new_columns,
      db: db,
      db_field_type: db_field_type,
      delete_item: delete_item,
      delete_all: delete_all,
      dump_table: dump_table,
      drop_table: drop_table,
      retrieveSchema: retrieveSchema,
      reify_results: reify_results,
      run_sql: run_sql,
      select_all: select_all,
      save: save,
      sql_values: sql_values,
      tables: tables,
      UNIT_TEST:UNIT_TEST
    }
  }
  
  return make_facade();
}

/*
db = openDatabase('db1', '1.0', 'my first database', 2 * 1024 * 1024);

function dump_row(row) {
  for (k in row) {
    console.log(k + " : " + row[k]);
  }
}

db.transaction(function(tx) {
  tx.executeSql("SELECT * from schema", [], function(tx, results) {
    console.log("Results:");
    console.log(results);
    console.log("Query returned " + results.rows.length + " rows");
    for (i = 0; i < results.rows.length; i++) {
      dump_row(results.rows.item(i));
    }
  });
});

db.transaction(function(tx) {
  console.log("Creating schema table");
  tx.executeSql("CREATE TABLE IF NOT EXISTS schema(table_name TEXT, col_name TEXT)");
});

db.transaction(function(tx) {
  console.log("Creating posts table");
  tx.executeSql("INSERT INTO schema (table_name,col_name) VALUES (?,?)", ['posts','url']);
});
*/