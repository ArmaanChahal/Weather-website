// script.js

$(function() {
    // ────────────────────────────────────────────────────────
    // CONFIG & STATE
    // ────────────────────────────────────────────────────────
    let lastLat = null, lastLon = null;
    let currentUnits = 'metric';   // "metric" or "imperial"
    let chartInstance = null;
    let clockTimer = null;
  
    // ────────────────────────────────────────────────────────
    // 1) PANEL TOGGLING
    // ────────────────────────────────────────────────────────
    $('#searchBtn').click(() => $('#searchModal').toggleClass('active'));
    $('.close-search').click(() => $('#searchModal').removeClass('active'));
    $('#settingsBtn').click(() => $('#settingsPanel').toggleClass('active'));
    $('.close-settings').click(() => $('#settingsPanel').removeClass('active'));
  
    // ────────────────────────────────────────────────────────
    // 2) SEARCH / AUTOCOMPLETE
    // ────────────────────────────────────────────────────────
    $('#citySearch').on('input', function() {
      const q = this.value.toLowerCase();
      const matches = cities
        .filter(c => c.name.toLowerCase().startsWith(q))
        .slice(0, 5);
      const $list = $('#searchSuggestions').empty();
      matches.forEach(c => {
        $('<div>')
          .addClass('suggestion-item')
          .text(`${c.name}, ${c.state ? c.state + ', ' : ''}${c.country}`)
          .appendTo($list);
      });
    });
  
    $(document).on('click', '.suggestion-item', function() {
      const city = $(this).text();
      $('#citySearch').val(city);
      $('#searchSuggestions').empty();
      $('#searchModal').removeClass('active');
      fetchCoordinates(city.split(',')[0].trim());
    });
  
    $('.search-submit').click(() => {
      const city = $('#citySearch').val().split(',')[0].trim();
      $('#searchModal').removeClass('active');
      fetchCoordinates(city);
    });
  
    $('#citySearch').on('keypress', function(e) {
      if (e.key === 'Enter') {
        const city = $(this).val().split(',')[0].trim();
        $('#searchModal').removeClass('active');
        fetchCoordinates(city);
      }
    });
  
    // ────────────────────────────────────────────────────────
    // 3) GEOLOCATION ON LOAD
    // ────────────────────────────────────────────────────────
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => console.warn('Geolocation unavailable')
      );
    }
  
    // ────────────────────────────────────────────────────────
    // 4) GEOCODING (Open‑Meteo)
    // ────────────────────────────────────────────────────────
    function fetchCoordinates(city) {
      axios.get('https://geocoding-api.open-meteo.com/v1/search', {
        params: { name: city, count: 1 }
      })
      .then(res => {
        const r = res.data.results;
        if (r && r.length) {
          fetchWeather(r[0].latitude, r[0].longitude);
        } else {
          console.error('Location not found');
        }
      })
      .catch(err => console.error('Geocoding error:', err));
    }
  
    // ────────────────────────────────────────────────────────
    // 5) FETCH FORECAST (Open‑Meteo)
    // ────────────────────────────────────────────────────────
    function fetchWeather(lat, lon) {
      lastLat = lat; lastLon = lon;
      axios.get('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: lat,
          longitude: lon,
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
            'relativehumidity_2m',
            'pressure_msl',
            'visibility',
            'cloudcover',
            'uv_index'
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
        startClock();
      })
      .catch(err => console.error('Forecast error:', err));
    }
  
    // ────────────────────────────────────────────────────────
    // 6) ICON MAPPING
    // ────────────────────────────────────────────────────────
    function getIcon(code) {
      if (code === 0)                   return '<i class="fas fa-sun"></i>';
      if (code <= 3)                    return '<i class="fas fa-cloud"></i>';
      if ([45,48].includes(code))       return '<i class="fas fa-smog"></i>';
      if (code >= 51 && code <= 67)     return '<i class="fas fa-cloud-rain"></i>';
      if (code >= 71 && code <= 77)     return '<i class="fas fa-snowflake"></i>';
      if (code >= 80 && code <= 82)     return '<i class="fas fa-cloud-showers-heavy"></i>';
      if (code >= 95 && code <= 99)     return '<i class="fas fa-bolt"></i>';
      return '<i class="fas fa-question"></i>';
    }
  
    // ────────────────────────────────────────────────────────
    // 7) DISPLAY CURRENT WEATHER + DETAILS
    // ────────────────────────────────────────────────────────
    function displayWeather(data) {
      const cw = data.current_weather;
      const now = new Date(cw.time);
  
      // Location & Date
      $('#currentCity').text(`${lastLat.toFixed(2)}, ${lastLon.toFixed(2)}`);
      $('#currentDate').text(now.toLocaleDateString());
  
      // Temperature & Icon
      let temp = cw.temperature;
      if (currentUnits === 'imperial') temp = temp * 9/5 + 32;
      $('#currentTemp').text(`${temp.toFixed(1)}°`);
      $('#currentCondition').html(getIcon(cw.weathercode));
  
      // Sunrise/Sunset/Daylight
      const sr = new Date(data.daily.sunrise[0]);
      const ss = new Date(data.daily.sunset[0]);
      $('#sunrise').text(sr.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
      $('#sunset' ).text(ss.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
      const diff = ss - sr;
      $('#daylight').text(`${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m`);
  
      // index for hourly arrays
      const cwTs = new Date(cw.time).getTime();
      let idx = data.hourly.time.findIndex(t => new Date(t).getTime() === cwTs);
      if (idx < 0) idx = 0;
  
      // Helpers to guard undefined
      function getHourlyField(field) {
        const arr = data.hourly[field];
        if (!arr || arr[idx] == null) return null;
        return arr[idx];
      }
  
      // Extras
      const feels = getHourlyField('apparent_temperature');
      $('#feelsLike').text(feels != null ? `${(currentUnits==='imperial' ? (feels*9/5+32) : feels).toFixed(1)}°` : '--');
  
      const dew = getHourlyField('dewpoint_2m');
      $('#dewPoint').text(dew != null ? `${(currentUnits==='imperial' ? (dew*9/5+32) : dew).toFixed(1)}°` : '--');
  
      const hum = getHourlyField('relativehumidity_2m');
      $('#humidity').text(hum != null ? `${hum}%` : '--%');
  
      const pop = getHourlyField('precipitation_probability');
      $('#precipitation').text(pop != null ? `${pop}%` : '--%');
  
      const pres = getHourlyField('pressure_msl');
      $('#pressure').text(pres != null ? `${pres.toFixed(0)} hPa` : '-- hPa');
  
      const vis = getHourlyField('visibility');
      $('#visibility').text(vis != null ? `${(vis/1000).toFixed(1)} km` : '-- km');
  
      let wind = getHourlyField('windspeed_10m');
      if (wind != null && currentUnits === 'imperial') wind *= 2.23694;
      $('#windSpeed').text(wind != null ? `${wind.toFixed(1)} ${currentUnits==='metric'?'m/s':'mph'}` : '--');
  
      const gust = getHourlyField('windgusts_10m');
      $('#windGusts').text(gust != null ? `${gust.toFixed(1)}` : '--');
  
      const wdir = getHourlyField('winddirection_10m');
      $('#windDirection').text(wdir != null ? `${wdir}°` : '--');
  
      const cc = getHourlyField('cloudcover');
      $('#cloudCover').text(cc != null ? `${cc}%` : '--%');
  
      const uv = getHourlyField('uv_index');
      $('#uvIndex').text(uv != null ? `${uv.toFixed(1)}` : '--');
  
      // Today's high/low
      const hi = data.daily.temperature_2m_max[0];
      const lo = data.daily.temperature_2m_min[0];
      $('#highTemp').text(`H: ${((currentUnits==='imperial'?hi*9/5+32:hi).toFixed(1))}°`);
      $('#lowTemp' ).text(`L: ${((currentUnits==='imperial'?lo*9/5+32:lo).toFixed(1))}°`);
    }
  
    // ────────────────────────────────────────────────────────
    // 8) HOURLY FORECAST (24h)
    // ────────────────────────────────────────────────────────
    function displayHourly(data) {
      const $h = $('#hourlyForecast').empty();
      data.hourly.time.slice(0,24).forEach((t,i) => {
        let tmp = data.hourly.temperature_2m[i];
        if (currentUnits === 'imperial') tmp = tmp * 9/5 + 32;
        const tm = new Date(t).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
        const ic = getIcon(data.hourly.weathercode[i]);
        $h.append(`
          <div class="hourly-item">
            <div class="hourly-time">${tm}</div>
            <div class="hourly-icon">${ic}</div>
            <div class="hourly-temp">${Math.round(tmp)}°</div>
          </div>`);
      });
    }
  
    // ────────────────────────────────────────────────────────
    // 9) DAILY FORECAST (7 days)
    // ────────────────────────────────────────────────────────
    function displayDaily(data) {
      const $d = $('#dailyForecast').empty();
      data.daily.time.slice(0,7).forEach((t,i) => {
        let hi = data.daily.temperature_2m_max[i];
        let lo = data.daily.temperature_2m_min[i];
        if (currentUnits === 'imperial') {
          hi = hi * 9/5 + 32;
          lo = lo * 9/5 + 32;
        }
        const day = new Date(t).toLocaleDateString([], {weekday:'short'});
        const ic  = getIcon(data.daily.weathercode[i]);
        $d.append(`
          <div class="daily-item">
            <div class="day-info">
              <span class="day-name">${day}</span>
              <div class="day-icon">${ic}</div>
            </div>
            <div class="day-temp">
              <span class="day-high">${Math.round(hi)}°</span>
              <span class="day-low">${Math.round(lo)}°</span>
            </div>
          </div>`);
      });
    }
  
    // ────────────────────────────────────────────────────────
    // 10) TEMPERATURE TRENDS CHART
    // ────────────────────────────────────────────────────────
    function renderChart(data) {
      const labels = data.hourly.time.slice(0,24).map(t =>
        new Date(t).toLocaleTimeString([], {hour:'2-digit'})
      );
      let temps = data.hourly.temperature_2m.slice(0,24);
      if (currentUnits === 'imperial') {
        temps = temps.map(t => t * 9/5 + 32);
      }
      const ctx = document.getElementById('weatherChart').getContext('2d');
      if (chartInstance) chartInstance.destroy();
      chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{ label: `Temp (°${currentUnits==='metric'?'C':'F'})`, data: temps, fill: false }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
  
    // ────────────────────────────────────────────────────────
    // 11) LIVE CLOCK
    // ────────────────────────────────────────────────────────
    function updateTime() {
      $('#currentTime').text(new Date().toLocaleTimeString());
    }
    function startClock() {
      clearInterval(clockTimer);
      updateTime();
      clockTimer = setInterval(updateTime, 1000);
    }
  
    // ────────────────────────────────────────────────────────
    // 12) SETTINGS CONTROLS
    // ────────────────────────────────────────────────────────
    // °C/°F toggle button
    $('#toggleUnit').click(() => {
      currentUnits = currentUnits === 'metric' ? 'imperial' : 'metric';
      $(`input[name="unit"][value="${currentUnits}"]`).prop('checked', true);
      if (lastLat != null) fetchWeather(lastLat, lastLon);
    });
    // radio buttons
    $('input[name="unit"]').change(function() {
      currentUnits = this.value;
      if (lastLat != null) fetchWeather(lastLat, lastLon);
    });
    // theme picker
    $('.theme-option').click(function() {
      $('.theme-option').removeClass('active');
      $(this).addClass('active');
      document.documentElement.setAttribute('data-theme', $(this).data('theme'));
    });
    // notifications
    $('#rainAlerts, #tempAlerts').change(function() {
      console.log(this.id, 'alerts:', this.checked);
    });
  });
  
