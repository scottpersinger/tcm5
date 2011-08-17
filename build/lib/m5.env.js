/*
       @@@@@@@@@@@@@>      @@@@@@@@@@>
       @>    @@@>  @>      @>         
       @>     @>   @>      @@@@@@@@@@>
       @>          @>               @>
       @>          @>               @>
       @>          @>      @@@@@@@@@>       

 (c) Scott Persinger 2011. See LICENSE.txt for license.

  This file sets up the app environment. It must be loaded directly after
  the m5.boot.js script. You can edit settings in this file by hand, but its
  easier to use the m5 server which can generate this file dynamically.
  
  Basic settings are:
  
  M5.set_env = 'development' | 'production' | 'testing'
  M5.env => return the environment
*/
M5.set_env('development');
M5.settings.app_name = "sample.cities";
M5.assume_browser(true);
