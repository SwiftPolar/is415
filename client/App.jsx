import injectTapEventPlugin from 'react-tap-event-plugin';
injectTapEventPlugin();
import React from "react";
import ReactDOM from "react-dom";

import AwesomeMarkers from "drmonty-leaflet-awesome-markers"

import AppBar from 'material-ui/lib/app-bar';
import LeftNav from 'material-ui/lib/left-nav';

import Card from 'material-ui/lib/card/card';
import CardHeader from 'material-ui/lib/card/card-header';
import CardText from 'material-ui/lib/card/card-text';
import TextField from 'material-ui/lib/text-field';
import SelectField from 'material-ui/lib/select-field';
import MenuItem from 'material-ui/lib/menus/menu-item';
import RaisedButton from 'material-ui/lib/raised-button';
import LinearProgress from 'material-ui/lib/linear-progress';

import List from 'material-ui/lib/lists/list';
import ListItem from 'material-ui/lib/lists/list-item';

var location, categories = [];


export default class extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            categories: categories,
            sidebar: true,
            sidebarWidth: window.innerWidth * 0.2,
            error: {
                stops: null,
                changes: null,
                location: null,
                walking: null
            },
            results: "Submit a request first!",
            resultsArr: [],
            loading: 0
        };


    }

    updateSidebar() {
        this.setState({sidebarWidth: window.innerWidth * 0.2});
    }

    componentWillMount() {
        Meteor.call('getCategories', (err, res) => {
            categories = res;
        });
    }

    componentDidMount() {
        window.addEventListener("resize", this.updateSidebar.bind(this));
        L.Icon.Default.imagePath = 'packages/bevanhunt_leaflet/images';
        map = L.map('map').setView([1.3553, 103.7968], 12);
        map.on('popupopen', (event) => {
            let popup = event.popup;
            let latlng = popup.getLatLng();
            this.setState({
                target: latlng
            });
        });

        L.tileLayer.provider('OpenStreetMap.Mapnik').addTo(map);

        let redMarker = L.AwesomeMarkers.icon({
            markerColor: 'red',
            prefix: 'fa',
            icon: 'fa-location-arrow'
        });

        location = L.marker([0, 0], {icon: redMarker}).addTo(map);

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                location.setLatLng([position.coords.latitude, position.coords.longitude]);
                this.setState({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });

            })
        }
        initialUpdate = Meteor.setInterval(() => {
            if (categories.keys().length !== 0) {
                this.setState({categories: categories, category: categories[0]});
                Meteor.clearInterval(initialUpdate);
            }
        }, 1000);




    }

    inputLocation(event) {
        if (event.keyCode === 13) {
            search.GetLocations(event.target.value + ", Singapore", (data) => {
                console.log(data);
                let lat = data[0].Y;
                let lng = data[0].X;
                location.setLatLng([lat, lng]);
                this.setState({
                    lat: lat,
                    lng: lng
                })
            });
        }
    }

    getCurrentLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                location.setLatLng([position.coords.latitude, position.coords.longitude]);
                this.setState({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });

            })
        }
    }

    inputStops(event) {
        this.setState({inputStops: event.target.value});
    }

    inputChanges(event) {
        this.setState({inputChanges: event.target.value});
    }

    inputWalking(event) {
        this.setState({inputWalking: event.target.value});
    }

    getCategories() {
        return (
            <SelectField
                value={this.state.category}
                fullWidth={true}
                onChange={(e, i, v)=>{this.setState({category: v})}}

            >
                {this.state.categories.map((cat) => (
                    <MenuItem key={cat} value={cat} primaryText={cat}/>
                ))}
            </SelectField>
        );
    }

    getDirections() {
        console.log("FROM: " + this.state.lat + "," + this.state.lng + " TO: " + this.state.target);
    }

    getResults() {
        let arr = this.state.resultsArr;
        if(arr.length > 0) {
            let results = [];
            arr.map((obj) => {
                results.push(
                    <ListItem
                        key={obj._id}
                        primaryText={obj.properties.name}
                        secondaryText={obj.properties.popup}
                        secondaryTextLines={2}
                    />
                );
            });

            return (
                <List>
                    {results.map((obj) => (obj))}
                </List>
            );
        }
    }

    submitForm() {
        //perform check if all fields are filled!
        let err = {
            stops: null,
            changes: null,
            location: null,
            walking: null
        };
        let haveErr = false;
        if (!this.state.lat || !this.state.lng) {
            err.location = "Please enter a location!";
            haveErr = true;
        }
        if (!this.state.inputStops || this.state.inputStops <= 0) {
            err.stops = "Please enter a value > 0!";
            haveErr = true;
        }
        if (!this.state.inputChanges || this.state.inputChanges < 0) {
            err.changes = "Please enter a value >= 0!";
            haveErr = true;
        }
        if (!this.state.inputWalking || this.state.inputWalking <= 0) {
            err.walking = "Please enter a value > 0!";
            haveErr = true;
        }
        if (haveErr) {
            this.setState({error: err});
        } else {
            this.setState({results: "In Progress!", loading: 0});
            Meteor.call('getStops', {lat: this.state.lat, lng: this.state.lng},
                this.state.inputStops, this.state.inputChanges, this.state.inputWalking, this.state.category
                );
            let loadProgress = Meteor.setInterval(() => {
                Meteor.call('getResults', (err, res) => {
                    if (typeof res === "object") {
                        //loading has already been completed
                        Meteor.clearInterval(loadProgress);
                        this.setState({loading: 1.0});
                        this.setState({results: "Completed", loading: 1});
                        Meteor.call('getResults', (err, res) => {
                            console.log("PROCESSING POI");
                            const onEachFeature = function(feature, layer) {
                                // does this feature have a property named popupContent?
                                if (feature.properties && feature.properties.popup) {
                                    layer.bindPopup(feature.properties.popup);
                                }
                            };

                            let geojsonFeature = {
                                "type": "FeatureCollection",
                                "features": res
                            };

                            L.geoJson(geojsonFeature, {
                                onEachFeature: onEachFeature,
                                style: {"color": "red"}
                            }).addTo(map);

                            this.setState({resultsArr: res});
                        })

                    } else if(this.state.loading < res) {
                        this.setState({loading: res});
                    } else {
                        this.setState({loading: this.state.loading + 0.01});
                    }
                })
            }, 5000);
        }

    }

    render() {
        return (
            <div style={{width: "100%", height: "100%"}}>
                <div style={{width: "80%", height: "100%"}}>
                    <AppBar title="How many stops away?"/>
                    <div id="map" style={{width: "100%", height: "95%"}}></div>
                </div>
                <div style={{width: "20%"}}>
                    <LeftNav
                        open={this.state.sidebar}
                        openRight={true}
                        width={this.state.sidebarWidth}
                    >
                        <Card>
                            <CardHeader
                                title="Step 1: Choose starting point"
                            />
                            <CardText>
                                <TextField
                                    hintText="input location"
                                    onKeyDown={this.inputLocation.bind(this)}
                                    fullWidth={true}
                                />
                            </CardText>
                            <RaisedButton label="Get Current Location" secondary={true} fullWidth={true}
                                          onTouchTap={this.getCurrentLocation.bind(this)}/>
                        </Card>
                        <Card>
                            <CardHeader
                                title="Step 2: Input number of stops"
                            />
                            <CardText>
                                <TextField
                                    hintText="input stops"
                                    onChange={this.inputStops.bind(this)}
                                    fullWidth={true}
                                    type="number"
                                    errorText={this.state.error.stops}
                                />
                            </CardText>
                        </Card>
                        <Card>
                            <CardHeader
                                title="Step 3: Input maximum number of changes"
                            />
                            <CardText>

                                <TextField
                                    hintText="input changes"
                                    onChange={this.inputChanges.bind(this)}
                                    type="number"
                                    fullWidth={true}
                                    errorText={this.state.error.changes}

                                />
                            </CardText>
                        </Card>
                        <Card>
                            <CardHeader
                                title="Step 4: Input maximum walking distance from stop"
                            />
                            <CardText>

                                <TextField
                                    hintText="input walking distance (m)"
                                    onChange={this.inputWalking.bind(this)}
                                    type="number"
                                    fullWidth={true}
                                    errorText={this.state.error.walking}

                                />
                            </CardText>
                        </Card>
                        <Card>
                            <CardHeader
                                title="Step 5: Select category"
                            />
                            <CardText>

                                {this.getCategories()}
                            </CardText>
                        </Card>
                        <Card>
                            <RaisedButton label="Submit" primary={true} fullWidth={true}
                                          onTouchTap={this.submitForm.bind(this)}/>
                        </Card>
                        <Card>
                            <CardHeader
                                title="Results"
                            />
                            <CardText>
                                <LinearProgress mode="determinate" value={this.state.loading} max={1}/>
                                {this.state.results}
                            </CardText>
                        </Card>
                        {this.getResults()}

                    </LeftNav>
                </div>


            </div>
        );
    }
}

/**
 * L.Control.GeoSearch - search for an address and zoom to it's location
 * L.GeoSearch.Provider.Google uses google geocoding service
 * https://github.com/smeijer/L.GeoSearch
 */

L.GeoSearch = {};
L.GeoSearch.Provider = {};

L.GeoSearch.Result = function (x, y, label, bounds, details) {
    this.X = x;
    this.Y = y;
    this.Label = label;
    this.bounds = bounds;

    if (details)
        this.details = details;
};

onLoadGoogleApiCallback = function () {
    L.GeoSearch.Provider.Google.Geocoder = new google.maps.Geocoder();
    document.body.removeChild(document.getElementById('load_google_api'));
};

L.GeoSearch.Provider.Google = L.Class.extend({
    options: {},

    initialize: function (options) {
        options = L.Util.setOptions(this, options);
        if (!window.google || !window.google.maps)
            this.loadMapsApi();
    },

    loadMapsApi: function () {
        var url = "https://maps.googleapis.com/maps/api/js?v=3&callback=onLoadGoogleApiCallback&sensor=false";
        var script = document.createElement('script');
        script.id = 'load_google_api';
        script.type = "text/javascript";
        script.src = url;
        document.body.appendChild(script);
    },

    GetLocations: function (qry, callback) {
        var geocoder = L.GeoSearch.Provider.Google.Geocoder;

        var parameters = L.Util.extend({
            address: qry
        }, this.options);

        var results = geocoder.geocode(parameters, function (data) {
            data = {results: data};

            var results = [],
                northEastLatLng,
                southWestLatLng,
                bounds;
            for (var i = 0; i < data.results.length; i++) {

                if (data.results[i].geometry.bounds) {
                    var northEastGoogle = data.results[i].geometry.bounds.getNorthEast(),
                        southWestGoogle = data.results[i].geometry.bounds.getSouthWest();

                    northEastLatLng = new L.LatLng(northEastGoogle.lat(), northEastGoogle.lng());
                    southWestLatLng = new L.LatLng(southWestGoogle.lat(), southWestGoogle.lng());
                    bounds = new L.LatLngBounds([northEastLatLng, southWestLatLng]);
                }
                else {
                    bounds = undefined;
                }
                results.push(new L.GeoSearch.Result(
                    data.results[i].geometry.location.lng(),
                    data.results[i].geometry.location.lat(),
                    data.results[i].formatted_address,
                    bounds
                ));
            }

            if (typeof callback == 'function')
                callback(results);
        });
    },
});

var search = new L.GeoSearch.Provider.Google();