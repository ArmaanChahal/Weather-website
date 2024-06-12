$(document).ready(function() {
    $('#searchIcon').click(function() {
        $('#searchPopup').toggle();
    });

    $('#city').on('input', function() {
        const query = $(this).val().toLowerCase();
        let matches = cities.filter(city => city.name.toLowerCase().startsWith(query));
        $('#suggestions').empty();
        if (matches.length > 0) {
            matches.forEach(city => {
                $('#suggestions').append(`<div class="suggestion-item">${city.name}, ${city.state ? city.state + ', ' : ''}${city.country}</div>`);
            });
        }
    });

    $(document).on('click', '.suggestion-item', function() {
        $('#city').val($(this).text());
        $('#suggestions').empty();
    });

    $('#getWeather').click(function() {
        const city = $('#city').val();
        fetchCoordinates(city);
    });

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            fetchWeather(lat, lon);
        });
    }

    function fetchCoordinates(city) {
        const apiKey = '65baaa9afbb64884874e3f16b7880401';
        const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                const { coord } = data;
                fetchWeather(coord.lat, coord.lon);
            })
            .catch(error => {
                console.error('Error fetching coordinates:', error);
            });
    }

    function fetchWeather(lat, lon) {
        const apiKey = '65baaa9afbb64884874e3f16b7880401';
        const apiUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;

        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                displayWeather(data);
                displayForecast(data);
                updateTime();
                setInterval(updateTime, 1000);
            })
            .catch(error => {
                console.error('Error fetching weather data:', error);
            });
    }

    function displayWeather(data) {
        const cityName = data.city.name;
        const dateTime = new Date().toLocaleString();
        const currentTemp = data.list[0].main.temp.toFixed(1) + '°C';
        const description = data.list[0].weather[0].description;
        let highTemp = -Infinity;
        let lowTemp = Infinity;

        data.list.forEach(forecast => {
            const forecastDate = new Date(forecast.dt * 1000);
            const today = new Date();
            if (forecastDate.getDate() === today.getDate()) {
                if (forecast.main.temp_max > highTemp) {
                    highTemp = forecast.main.temp_max;
                }
                if (forecast.main.temp_min < lowTemp) {
                    lowTemp = forecast.main.temp_min;
                }
            }
        });

        highTemp = highTemp.toFixed(1) + '°C High';
        lowTemp = lowTemp.toFixed(1) + '°C Low';

        const windSpeed = data.list[0].wind.speed.toFixed(1) + ' m/s Wind';
        const rainChance = (data.list[0].rain && data.list[0].rain['3h']) ? data.list[0].rain['3h'] + '% Rain' : '0% Rain';
        const sunrise = new Date(data.city.sunrise * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const sunset = new Date(data.city.sunset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        $('#cityName').text(cityName);
        $('#dateTime').text(dateTime);
        $('#temperature').text(currentTemp);
        $('#description').text(description);
        $('#highTemp').text(highTemp);
        $('#lowTemp').text(lowTemp);
        $('#windSpeed').text(windSpeed);
        $('#rainChance').text(rainChance);
        $('#sunrise').text(sunrise);
        $('#sunset').text(sunset);

        $('body').css('background-image', getBackgroundImage(data.list[0].weather[0].main.toLowerCase()));
    }

    function displayForecast(data) {
        const futureTemperatures = $('#futureTemperatures');
        futureTemperatures.empty();

        const dailyData = {};
        let overallMinTemp = Infinity;

        data.list.forEach(forecast => {
            const forecastDate = new Date(forecast.dt * 1000).toLocaleDateString();
            if (!dailyData[forecastDate]) {
                dailyData[forecastDate] = [];
            }
            dailyData[forecastDate].push(forecast);

            if (forecast.main.temp_min < overallMinTemp) {
                overallMinTemp = forecast.main.temp_min;
            }
        });

        Object.keys(dailyData).slice(1, 5).forEach(date => {
            const dayData = dailyData[date];
            let tempMax = -Infinity;
            let tempMin = Infinity;
            let icon;

            dayData.forEach(forecast => {
                if (forecast.main.temp_max > tempMax) {
                    tempMax = forecast.main.temp_max;
                }
                if (forecast.main.temp_min < tempMin) {
                    tempMin = forecast.main.temp_min;
                }
                icon = forecast.weather[0].icon;
            });

            const dayLabel = new Date(date).toLocaleDateString([], { weekday: 'short', day: 'numeric' });

            futureTemperatures.append(`
                <div class="col future-temp-item">
                    <div class="date">${dayLabel}</div>
                    <div><img src="http://openweathermap.org/img/wn/${icon}.png" alt="${icon}"></div>
                    <div class="temp">${Math.round(tempMax)}°C / ${Math.round(tempMin)}°C</div>
                </div>
            `);
        });

        const labels = Object.keys(dailyData).slice(0, 5).map(date => new Date(date).toLocaleDateString([], { weekday: 'short', day: 'numeric' }));
        const temperatures = Object.keys(dailyData).slice(0, 5).map(date => {
            const dayData = dailyData[date];
            return dayData.reduce((sum, forecast) => sum + forecast.main.temp, 0) / dayData.length;
        });

        const ctx = document.getElementById('temperatureChart').getContext('2d');
        const yMin = Math.round(overallMinTemp - 5);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Avg Temperature',
                    data: temperatures,
                    borderColor: 'rgba(255, 255, 255, 1)',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    fill: true,
                }]
            },
            options: {
                scales: {
                    y: {
                        min: yMin,
                        ticks: {
                            color: 'white' 
                        }
                    },
                    x: {
                        ticks: {
                            color: 'white' 
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: 'white'
                        }
                    }
                }
            }
        });
    }

    function updateTime() {
        const now = new Date();
        $('#dateTime').text(now.toLocaleString());
    }

    function getBackgroundImage(weatherCondition) {
        switch(weatherCondition) {
            case 'clear':
                return 'url(sunny.jpg)';
            case 'clouds':
                return 'url(cloudy.jpg)';
            case 'rain':
                return 'url(rainy.jpg)';
            case 'snow':
                return 'url(snowy.jpg)';
            default:
                return 'url(default.jpg)';
        }
    }
});
