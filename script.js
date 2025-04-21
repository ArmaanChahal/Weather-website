// script.js

$(function() {
  let lastLat = null, lastLon = null;
  let currentUnits = 'metric';
  let chartInstance = null;

  // 1) PANEL TOGGLING
  $('#searchBtn').click(() => $('#searchModal').toggleClass('active'));
  $('.close-search').click(() => $('#searchModal').removeClass('active'));
  $('#settingsBtn').click(() => $('#settingsPanel').toggleClass('active'));
  $('.close-settings').click(() => $('#settingsPanel').removeClass('active'));

  // 2) AUTOCOMPLETE
  $('#citySearch').on('input', function() {
    const q = this.value.toLowerCase();
    const matches = cities.filter(c=>c.name.toLowerCase().startsWith(q)).slice(0,5);
    const $list = $('#searchSuggestions').empty();
    matches.forEach(c=>$('<div>')
      .addClass('suggestion-item')
      .text(`${c.name}, ${c.state?c.state+', ':''}${c.country}`)
      .appendTo($list)
    );
  });
  $(document).on('click','.suggestion-item',function(){
    $('#citySearch').val(this.textContent);
    $('#searchSuggestions').empty();
    $('#searchModal').removeClass('active');
    fetchCoordinates(this.textContent);
  });
  $('.search-submit').click(()=>fetchCoordinates($('#citySearch').val()));

  // 3) GEOLOCATION ON LOAD
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(p=>fetchWeather(p.coords.latitude,p.coords.longitude));
  }

  // 4) GEOCODING → lat/lon
  function fetchCoordinates(city) {
    axios.get('https://geocoding-api.open-meteo.com/v1/search', { params:{ name: city, count:1 } })
      .then(res => {
        const r = res.data.results?.[0];
        if (r) fetchWeather(r.latitude, r.longitude);
        else console.error('Location not found');
      })
      .catch(console.error);
  }

  // 5) FETCH FORECAST
  function fetchWeather(lat, lon) {
    lastLat = lat; lastLon = lon;
    axios.get('https://api.open-meteo.com/v1/forecast', {
      params:{
        latitude: lat, longitude: lon,
        current_weather: true,
        hourly: [
          'temperature_2m',
          'apparent_temperature',
          'dewpoint_2m',
          'precipitation_probability',
          'weathercode',
          'windspeed_10m',
          'windgusts_10m',
          'winddirection_10m',
          'cloudcover',
          'uv_index',
          'relativehumidity_2m',
          'pressure_msl',
          'visibility'
        ].join(','),
        daily: [
          'temperature_2m_max',
          'temperature_2m_min',
          'sunrise',
          'sunset',
          'weathercode'
        ].join(','),
        timezone: 'auto'
      }
    })
    .then(res => {
      const data = res.data;
      displayWeather(data);
      displayHourly(data);
      displayDaily(data);
      renderChart(data);
      startClock();               // kick off the clock
    })
    .catch(console.error);
  }

  // 6) ICON MAPPING
  function getIcon(code) {
    if (code===0) return '<i class="fas fa-sun"></i>';
    if (code <= 3) return '<i class="fas fa-cloud"></i>';
    if ([45,48].includes(code)) return '<i class="fas fa-smog"></i>';
    if (code>=51 && code<=67) return '<i class="fas fa-cloud-rain"></i>';
    if (code>=71 && code<=77) return '<i class="fas fa-snowflake"></i>';
    if (code>=80 && code<=82) return '<i class="fas fa-cloud-showers-heavy"></i>';
    if (code>=95 && code<=99) return '<i class="fas fa-bolt"></i>';
    return '<i class="fas fa-question"></i>';
  }

  // 7) DISPLAY CURRENT + EXTRAS + HIGH/LOW
  function displayWeather(data) {
    const cw = data.current_weather;
    const t0 = cw.time;
    const idx = data.hourly.time.indexOf(t0);

    // location & date/time
    $('#currentCity').text(`${data.latitude.toFixed(2)}, ${data.longitude.toFixed(2)}`);
    $('#currentDate').text(new Date(t0).toLocaleDateString());

    // high / low from today’s daily[0]
    const hi = data.daily.temperature_2m_max[0];
    const lo = data.daily.temperature_2m_min[0];
    $('#highTemp').text(`H: ${hi.toFixed(1)}°`);
    $('#lowTemp').text(`L: ${lo.toFixed(1)}°`);

    // clock will update itself
    updateTime();

    // temp & feels
    let temp  = cw.temperature;
    let feels = data.hourly.apparent_temperature[idx];
    if (currentUnits==='imperial') {
      temp = temp*9/5+32;
      feels= feels*9/5+32;
    }
    $('#currentTemp').text(`${temp.toFixed(1)}°${currentUnits==='metric'?'C':'F'}`);
    $('#feelsLike').text(`${feels.toFixed(1)}°`);

    // condition icon
    $('#currentCondition').html(getIcon(cw.weathercode));

    // sunrise/sunset/daylight
    const sr = new Date(data.daily.sunrise[0]);
    const ss = new Date(data.daily.sunset[0]);
    $('#sunrise').text(sr.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
    $('#sunset').text(ss.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
    const diff = ss - sr;
    $('#daylight').text(`${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m`);

    // other details
    let ws = data.hourly.windspeed_10m[idx];
    if (currentUnits==='imperial') ws*=2.23694;
    $('#windSpeed').text(`${ws.toFixed(1)} ${currentUnits==='metric'?'m/s':'mph'}`);
    $('#humidity').text(`${data.hourly.relativehumidity_2m[idx]}%`);
    $('#precipitation').text(`${data.hourly.precipitation_probability[idx]}%`);
    $('#pressure').text(`${data.hourly.pressure_msl[idx].toFixed(0)} hPa`);
    $('#visibility').text(`${(data.hourly.visibility[idx]/1000).toFixed(1)} km`);
    $('#uvIndex').text(`${data.hourly.uv_index[idx].toFixed(1)}`);
    $('#dewPoint').text(`${data.hourly.dewpoint_2m[idx].toFixed(1)}°`);
  }

  // 8) HOURLY FORECAST
  function displayHourly(data) {
    const $h = $('#hourlyForecast').empty();
    data.hourly.time.slice(0,24).forEach((t,i) => {
      let tmp = data.hourly.temperature_2m[i];
      if (currentUnits==='imperial') tmp = tmp*9/5+32;
      const time = new Date(t).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      $h.append(`
        <div class="hourly-item">
          <div class="hourly-time">${time}</div>
          <div class="hourly-icon">${getIcon(data.hourly.weathercode[i])}</div>
          <div class="hourly-temp">${Math.round(tmp)}°</div>
        </div>`);
    });
  }

  // 9) DAILY FORECAST
  function displayDaily(data) {
    const $d = $('#dailyForecast').empty();
    data.daily.time.slice(0,7).forEach((t,i) => {
      let hi = data.daily.temperature_2m_max[i];
      let lo = data.daily.temperature_2m_min[i];
      if (currentUnits==='imperial') {
        hi = hi*9/5+32; lo = lo*9/5+32;
      }
      const day = new Date(t).toLocaleDateString([], {weekday:'short'});
      $d.append(`
        <div class="daily-item">
          <div class="day-info">
            <span class="day-name">${day}</span>
            <div class="day-icon">${getIcon(data.daily.weathercode[i])}</div>
          </div>
          <div class="day-temp">
            <span class="day-high">${Math.round(hi)}°</span>
            <span class="day-low">${Math.round(lo)}°</span>
          </div>
        </div>`);
    });
  }

  // 10) CHART.JS
  function renderChart(data) {
    const labels = data.hourly.time.slice(0,24).map(t =>
      new Date(t).toLocaleTimeString([], {hour:'2-digit'})
    );
    let temps = data.hourly.temperature_2m.slice(0,24);
    if (currentUnits==='imperial') temps = temps.map(t=>t*9/5+32);
    const ctx = document.getElementById('weatherChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label:`Temp (°${currentUnits==='metric'?'C':'F'})`, data:temps, fill:false }] },
      options:{ responsive:true, maintainAspectRatio:false }
    });
  }

  // 11) CLOCK
  function updateTime() {
    const now = new Date();
    $('#currentTime').text(now.toLocaleTimeString());
  }
  let timer;
  function startClock() {
    clearInterval(timer);
    updateTime();
    timer = setInterval(updateTime, 1000);
  }

  // 12) SETTINGS CONTROLS
  $('input[name="unit"]').change(function(){
    currentUnits = this.value;
    if (lastLat !== null) fetchWeather(lastLat, lastLon);
  });
  $('.theme-option').click(function(){
    $('.theme-option').removeClass('active');
    $(this).addClass('active');
    document.documentElement.setAttribute('data-theme', $(this).data('theme'));
  });
  $('#rainAlerts, #tempAlerts').change(function(){
    console.log(this.id, this.checked);
  });
});
