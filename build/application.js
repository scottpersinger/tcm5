// Place your main application logic here


/* BlogReader class */
M5.require('SimpleStorage');
M5.require('M5.util');

function BlogReader(db) {

  var tc_home = 'http://techcrunch.com';
  //tcurl = 'http://localhost:8000/jqtouch-bee/test/techcrunch.html';
  
  function demarshal_post(post) {
    var datestr = post.date.substring(0,10).replace(/-/g,'/');
    res = new Date(Date.parse(datestr));
    post.date = res;
    return post;
  }

  function tc_iphone_scrape() {
    posts = [];

    $('.post').each(function() {
      post = {};

      root = $(this);
      post.title = root.find('.h2').text();
      post.url = root.find('.h2').attr('href');

      post.date = root.find('.calendar').text();
      post.author = root.find('.post-author').text().replace('Author: ','');
      post.body = root.find('.mainentry').html();
      post.img = root.find('.mainentry img').attr('src');

      return posts.push(post);
    });

    return posts;
  }

  function tc_new_scrape() {
    posts = [];
    
    $('.post').each(function() {
      post = {};
      root = $(this);
      
      post.title = $.trim(root.find('h2').text());
      post.url = root.find('h2 a').attr('href');

      post.date = root.find('.post-time').text();
      post.author = $.trim(root.find('.by-line').text());
      post.body = root.find('.body-copy').html();
      post.img = root.find('.media-container img').attr('data-src');
      
      posts.push(post);
    });
    
    return posts;
  }
  
  function load_tc_home(callback) {
    var lines = tc_new_scrape.toString().split("\n");
    var body = lines.splice(1, lines.length-2).join("\n");

    var tcurl = 'http://techcrunch.com';
    //tcurl = 'http://localhost:8000/jqtouch-bee/test/techcrunch.html';

    console.log("Loading Techcrunch home page");
    var scrapeUrl = localStorage.getItem('scrapeUrl');
    scrapeUrl = scrapeUrl || 'http://api.m5apps.org/scrape';

    M5.util.bench_start("scrape");
    $.post(scrapeUrl, 
      {url:tcurl, agent:'Desktop', 
       body:body}, function(res) {
         M5.util.bench_end("scrape");
         callback(res);
    }).error(function(jqXHR, textStatus, errorThrown) {
       if (errorThrown) {
         errorThrown = errorThrown.message;
       }
       alert('TC scrape error (' + scrapeUrl + '): ' + textStatus + ': ' + errorThrown);
     });
  }

  function loadStory(url, callback) {
    var scrapeUrl = localStorage.getItem('scrapeUrl');
    scrapeUrl = scrapeUrl || 'http://api.m5apps.org/scrape';
    
    var uid = M5.util.hash(url, 999999);
    db.select_all('stories', {where: {uid: uid}}, function(results) {
      if (results.length > 0) {
        callback(results[0].body); 
      } else {
        $.post(scrapeUrl,
            {url: url, body: "post = $('.body-copy'); post.find(\"span,div,object,iframe,script\").remove(); return post.html()" },
            function(res) {
              console.log("Retrieved full story: " + res);
              callback(res);
              story = {uid: uid, body: res};
              db.save('stories', story);
            }
        );
      }
    });
  }
  
  function run_locally(flag) {
    alert("Set local: " + flag);
    if (flag) {
      localStorage.setItem('scrapeUrl', 'http://localhost:8080/scrape');
    } else {
      localStorage.removeItem('scrapeUrl');
    }

  }

  function clear_storage() {
    db.drop_table('posts');
    db.drop_table('stories');
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      keys.push(localStorage.key(i));
    }
    $.each(keys, function() { localStorage.removeItem(this) });
    
  }

  var $posts = null;
  var $uids = {};
  
  // posts is an array stored locally with our current set of stories in reverse
  // chron order. To maintain the order, we prepend new stories to the array.

  function loadStoredPosts(postBuilder, completion) {
    db.select_all('posts', {order:{'id': 'desc'}, limit:30}, function(posts) {
      $posts = posts;
      $.each(posts, function() {
        $uids[this.uid] = true;
        postBuilder(this);
      });
      completion(true);
    });
  }
  
  function loadNewPosts(postsBuilder, completion) {
    load_tc_home(function(results) {
      if (results && $.isArray(results)) {
        decorate_posts(results);
        // display and save any new posts
        var new_posts = [];
        $.each(results.reverse() /* oldest first */, function(index, item) {
          if (!$uids[item.uid]) {
            $uids[item.uid] = true;
            new_posts.push(item);
            $posts.unshift(item);
            postBuilder(item, true);
          }
        });
        
        // save new posts
        db.save('posts', new_posts, function() {
          db.create_index('posts', 'uid');
        });
        
        completion(true);
      } else {
        completion(false);
      }
    });
  }

  function decorate_posts(items) {
    $.each(items, function() {
      var m;
      if ((m = this.url.match(/20\d\d\/\d\d\/\d\d/))) {
        //console.log("Parsing date: " + m[0]);
        this.date = new Date(Date.parse(m[0]));
      } else {
        this.date = new Date();
      }
      this.uid = M5.util.hash(this.url, 999999);
    });
  }
  
  function showPosts(new_items, postBuilder) {
    console.log("loadNewPosts");

    M5.util.bench_start("getObject:posts");
    db.select_all('posts', {order:'id'}, function(posts) {
      // new_items is newest first, latest last. So process them in reverse order
      // and prepend to the posts array.
      M5.util.bench_start("process posts");

      db.save('posts', new_items, function() {
        db.create_index('posts', 'uid');
        M5.util.bench_end("setObject:urls:items");
        
        M5.util.benchmark('display posts', function() {
        });
      })

      
    });

  }

  return {
    loadStoredPosts: loadStoredPosts,
    loadNewPosts: loadNewPosts,
    loadStory: loadStory,
    runLocally: run_locally,
    reset: clear_storage
  }
};
  



function postBuilder(post, prepend) {
  var postsDiv = $('#posts');

  if (latestDate && post.date > latestDate) {
    latestDate = post.date;
  } else {
    latestDate = post.date;
  }
  
  //console.log(post.date + " - " + post.title);
  if (!prepend) {
    // adding to the end, if we see a new date then add a date marker
    if (post.date && !post.date.datesEqual(earliestDate)) {
      earliestDate = post.date;
      
      postsDiv.append('<li data-role="list-divider">' + post.date.toLocaleDateString() + '</li>');
    }
  } else {
    // adding to the beginning 
    // if (post.date && !post.date.datesEqual(latestDate)) {
    //   // add above date header
    //   latestDate = post.date;
    //   postsDiv.prepend('<li class="sep">' + post.date.toLocaleDateString() + '</li>');
    // }
  }
  var imgSrc = post.img;
  if (imgSrc) {
    //imgSrc = 'http://tc.gouplevel.com/resize?url=' + encodeURIComponent(imgSrc) + "&dim=60x60";
    //imgSrc = ImageCache.image_src(imgSrc);
  }
  imgSrc = imgSrc || null;
  var imgTag = (imgSrc  && show_images) ? ('<img src="' + imgSrc + '" id="' + post.uid + '-thumb" NOonload="ImageCache.cache(this,60,60)" />') : '';
  var postText = '<li id="' + post.uid + '"><a href="#fullstory">' + 
      '<span class="ui-li-thumb">' + imgTag + '</span>' +
      '<h3>' + post.title + '</h3></a>' + '<span class="author">' + post.author  +'</span>' +
      '<div style="clear:both">' + '</li>';
  if (prepend) {
    var dateSep = postsDiv.find('.sep:first');
    if (dateSep.length > 0) {
      dateSep.after(postText);
    } else {
      postsDiv.prepend(postText);
    }
  } else {
    postsDiv.append(postText);
  }

  $('#' + post.uid).data('post', post);

}
