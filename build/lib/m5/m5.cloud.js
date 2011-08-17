/*
 @@@@@@@@@@@@@>      @@@@@@@@@@>
 @>    @@@>  @>      @>         
 @>     @>   @>      @@@@@@@@@@>
 @>          @>               @>
 @>          @>               @>
 @>          @>      @@@@@@@@@>       

 (c) Scott Persinger 2011. See LICENSE.txt for license.
 
 M5 cloud
*/
M5.require("jQuery");

M5.cloud = (function() {
  var api_endpoint = "http://api.m5apps.org";
  
  return {
    scrape: scrape,
    proxy: proxy,
    endpoint: api_endpoint
  }
  
  function scrape(url, body, callback, error_callback) {
    $.post(
        api_endpoint + "/scrape",
        {url: url, body: body, agent: 'Desktop'}, 
        callback,
        'json').error(function(event, jqXHR, thrownError) {
          if (error_callback) {
            error_callback(event.responseText);
          } else {
            general_error(event, jqXHR, thrownError);
          }
        });
  }
  
  function proxy() {
    
  }
  
  function general_error(event, jqXHR, thrownError) {
    console.log("Ajax error: " + event.responseText);
  }
})();