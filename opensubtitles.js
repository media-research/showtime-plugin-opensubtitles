/*
 *  Opensubtitles plugin
 *
 *  Copyright (C) 2013 Andreas Öman
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

(function(plugin) {

  var APIURL = "http://api.opensubtitles.org/xml-rpc";
  var token = null;

  function trace(str) {
    showtime.trace(str, 'opensubtitles');
  }

  function login(force) {

    if(token === null || force) {
      
      trace('Attempting to login as anonymous user');

      var r = showtime.xmlrpc(APIURL, "LogIn", '', '', 'en',
			      'Showtime ' + showtime.currentVersionString);
      
      if(r[0].status == '200 OK') {
	token = r[0].token;
	trace('Login OK');
      } else {
	token = null;
	trace('Login failed: ' + r[0].status);
      }
    }
  }


  plugin.addSubtitleProvider(function(req) {

    var queries = [];

    // Get list of user preferred languages for subs
    var lang = showtime.getSubtitleLanguages().join(',');

    // Build a opensubtitle query based on request from Showtime

    if(req.filesize) {
      queries.push({
	sublanguageid: lang,
	moviehash: req.opensubhash,
	moviebytesize: req.filesize.toString()
      });
    }
      
    if(req.imdb && req.imdb.indexOf('tt') == 0) {
      queries.push({
	sublanguageid: lang,
	imdbid: req.imdb.substring(2)
      });
    } else if(req.title) {
      var q = {
	sublanguageid: lang,
	query: req.title
      };

      if(req.season > 0 && req.episode > 0) {
	q.season = req.season;
	q.episode = req.episode;
      }

      queries.push(q);
    }

    // Loop so we can retry once (relogin) if something fails
    // This typically happens if the token times out

    for(var retry = 0; retry < 2; retry++) {
      login(retry);

      var r = showtime.xmlrpc(APIURL, "SearchSubtitles", token, queries);
    
      if(r[0].status == '200 OK' && typeof(r[0].data == 'object')) {
	var set = {}; // We can get same subtitle multiple times, so keep track
	var cnt = 0;
	for(var i in r[0].data) {

	  var sub = r[0].data[i];
	  var url = sub.SubDownloadLink;

	  if(url in set)
	    continue;

	  set[url] = true;

	  var score = 0;
	  if (sub.MatchedBy == 'moviehash') 
	    score++; // matches by file hash is better
	  
	  req.addSubtitle(url, sub.SubFileName, sub.SubLanguageID,
			  sub.SubFormat,
			  'opensubtitles (' + sub.MatchedBy + ')',
			  score);
	  cnt++;
	}
      	trace('Added ' + cnt + ' subtitles');

	return;
      } else {
      	trace('Query failed: ' + r[0].status);
      }
    }
  });

})(this);