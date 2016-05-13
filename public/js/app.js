var terrapatternMap = (function(){


  // CONSTANTS

  // Explicitly magic numbers.  
  var LAT_OFFSET = 0.0005225;
  var LNG_OFFSET = 0.0006865;

  var THUMBNAILS_PER_PAGE = 18;

  var THE_WHOLE_WORLD = [
          [0, 90],
          [180, 90],
          [180, -90],
          [0, -90],
          [-180, -90],
          [-180, 0],
          [-180, 90],
          [0, 90]
  ];
  var BOUNDARY_STYLE = {
      strokeWeight: 0,
      fillColor: "#000000",
      fillOpacity: .7
  };
  var MAP_OPTIONS = {
            center: {lat: map_center.lat, lng: map_center.lng},
            zoom: 17,
            mapTypeId: "satellite",
            mapTypeControl: false,
            streetViewControl: false,
            rotateControl: false,
            fullscreenControl: false,
            clickableIcons: false,
            tilt: 0,
            maxZoom: 19,
            minZoom: 10
  };

  //Internal module variables
  var lastValidCenter;
  var defaultBounds;
  var map;
  var pinIds = [];
  var tileRectangle; 
  var pins;
  var paginationCurrentPage;
  var searchBox;

  function getCurrentTileBounds(lat,lng) {
    lat = lat-LAT_OFFSET/2;
    lng = lng-LNG_OFFSET/2;
    var minLng = bounding_box.sw_lng;
    var minLat = bounding_box.sw_lat;

    var north = minLat + Math.floor((lat-minLat)/LAT_OFFSET)*LAT_OFFSET+LAT_OFFSET/2;
    var south = minLat + Math.ceil((lat-minLat)/LAT_OFFSET)*LAT_OFFSET+LAT_OFFSET/2;
    var west = minLng + Math.floor((lng-minLng)/LNG_OFFSET)*LNG_OFFSET+LNG_OFFSET/2;
    var east = minLng + Math.ceil((lng-minLng)/LNG_OFFSET)*LNG_OFFSET+LNG_OFFSET/2;

    return {
      north: north,
      south: south,
      east:  east,
      west: west,
    };
  }

  function goToPin(id) {
    console.log("going to pin", id)
    var pinToSelect = map.data.getFeatureById(id);
    latLng = pinToSelect.getGeometry().get();
    map.setCenter(latLng);
    map.setZoom(18);
    handleDrawingRectangle(null, latLng);
  }

  //-----------------
  function getTileImage(lat,lng,id="",size=256) {
    var url = "https://maps.googleapis.com/maps/api/staticmap?maptype=satellite&zoom=19";
    url = url + "&center=" + lat + "," + lng;
    url = url + "&size=" + size + "x" + size;
    url = url + "&key=" + MAPS_API_KEY;
    return "<div class='location_tile' id='"+id+"'><img alt='' src='"+url+"'/></div>"
  } 

  //-----------------
  function hideEverythingBut(and_then_show=null) {
    $('#result-grid').addClass("hidden");
    $('#no-results').addClass("hidden");
    $('#waiting').addClass("hidden");
    $(and_then_show).removeClass("hidden");
  }

  //-----------------
  function handlePan() {
    if (defaultBounds.contains(map.getCenter())) {
        // still within valid bounds, so save the last valid position
        lastValidCenter = map.getCenter();
        return; 
    }
    // not valid anymore => return to last valid position
    map.panTo(lastValidCenter);
  }

  //-----------------
  function handleSearch() {
    var places = searchBox.getPlaces();

    if (places.length == 0) {
      return;
    }
    var new_location = places[0];
    map.panTo(new_location.geometry.location);
    map.setZoom(18);
  }

  //-----------------
  function handleClick(e) {
      
      hideEverythingBut('#waiting');
      console.log("searching");


      // var data = 
      var data = tileRectangle.getBounds().getCenter();
      var results = $.get("/search", {lat: data.lat(), lng: data.lng()});
      results.done(handleNewPins);
  }

  function handleNewPins(e) {

    // setup ui
    hideEverythingBut('#result-grid');
   
    // cleanup old pins
    pinIds.forEach(function(p) {
      map.data.remove(map.data.getFeatureById(p));
    })

    pins = map.data.addGeoJson(e);

    // add new pins
    var pinBounds = new google.maps.LatLngBounds();
    pinIds = [];
    for (var i = 0; i < pins.length; i++) {
      pinIds.push(pins[i].getId());
      pinBounds.extend( pins[i].getGeometry().get());
    }

    showThumbnails(0);

    // zoom
    map.fitBounds(pinBounds);
  }


  function drawPagination(currentPage) {
    paginationCurrentPage = currentPage;

    var totalNumberOfPages = Math.ceil(pins.length/THUMBNAILS_PER_PAGE);
    var str = "<nav>"
    str    += "<ul class='pagination pagination-sm'>"

    str    += "<li class='"
    if (currentPage == 0){str +="disabled";}
    str    += "'><a href='#'>&laquo;</a></li>"
    
    for (var q1 = 1; q1 <=totalNumberOfPages; q1++) {
      str   += "<li class='"
      if (q1 == currentPage+1) {str   += "active";}
      str   += "'><a href='#'>"+q1+"</a></li>"
    }

    str    += "<li class='"
    if (currentPage == totalNumberOfPages-1 ){str +="disabled";}
    str    += "'><a href='#'>&raquo;</a></li>"

    str    += "</ul>"
    str    += "</nav>"
    $("#results_pagination").html(str);
  }

  function showThumbnails(page) {
    var pinId, pinGeo; 

    // cleanup
    $('.location_tile').remove();

    // math the things
    var startingThumb = THUMBNAILS_PER_PAGE*page;
    var numberOfThumbs = pins.length > startingThumb+THUMBNAILS_PER_PAGE ? THUMBNAILS_PER_PAGE : pins.length-startingThumb;

    // add the tiles
    for (var i = startingThumb; i < startingThumb+numberOfThumbs; i++) {
      pinId = pins[i].getId();
      pinGeo = pins[i].getGeometry().get();
      $("#results_grid").append(getTileImage(pinGeo.lat(), pinGeo.lng(), pinId));
    }
    drawPagination(page);
  }


  //-----------------
  function initMap() {
    tileRectangle = new google.maps.Rectangle();

    // Set the search boundary (just a hint, not a requirement)
    defaultBounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(bounding_box.sw_lat, bounding_box.sw_lng),
      new google.maps.LatLng(bounding_box.ne_lat, bounding_box.ne_lng)
    );

    // Initialize the map object
    map = new google.maps.Map(document.getElementById('main-map'), MAP_OPTIONS);  
    lastValidCenter = map.getCenter();

    // Initialize the grey boundary
    boundary.geometry.coordinates.unshift(THE_WHOLE_WORLD);
    map.data.addGeoJson(boundary);
    map.data.setStyle(BOUNDARY_STYLE);

    // Set up the search box
    var input = document.getElementById('search_box');
    searchBox = new google.maps.places.SearchBox(input, {bounds: defaultBounds});
    searchBox.setBounds(map.getBounds());
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

    // Set up the event handlers
    map.addListener('center_changed',handlePan);
    map.addListener('mousemove',handleDrawingRectangle);
    map.addListener('click', handleClick);
    searchBox.addListener('places_changed', handleSearch);

    $("#results_pagination").on("click", "li", handlePaginationClick)    
    $("#results_grid").on("click", ".location_tile", function(){
      goToPin($(this).attr("id"))
    })
  }

  function handlePaginationClick(e) {
    e.preventDefault();
    var pagenum = $(this).text();
    console.log("pagenum",pagenum);
    if ($(this).hasClass("disabled")) {return}
    else if (pagenum-1 == paginationCurrentPage) {return}
    else if (pagenum == "«") {showThumbnails(paginationCurrentPage - 1)}
    else if (pagenum == "»") {showThumbnails(paginationCurrentPage + 1)}
    else { showThumbnails(pagenum -1)};
  }

  function handleDrawingRectangle(e, point = false) {
    var point = point ? point : e.latLng;
    var bounds = getCurrentTileBounds(point.lat(), point.lng())

    // var rectBounds = tileRectangle.getBounds();
    // if (rectBounds && rectBounds.equals(bounds)) {
    //   console.log('dup');
    //   return};
    console.log("centered at:", bounds)
    tileRectangle.setOptions({
      strokeColor: '#000000',
      strokeOpacity: 0.6,
      strokeWeight: 1,
      fillColor: '#FFFFFF',
      fillOpacity: 0.1,
      clickable: false,
      map: map,
      bounds: bounds
    });
  }


  // Expose the module's interface to the world (you naughty code, you).
  return {
    initialize: initMap,
    gotoPage: showThumbnails
  };
}());

