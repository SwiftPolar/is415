Meteor.startup(() => {
    // code to run on server at startup
});

var getBusID = function (obj) {
    let results = [];
    obj.map((val) => {
        results.push(val.id);
    });
    return results;
};

var userRequest = {};
var requestHistory = {};

Meteor.methods({
    getCategories: () => {
        let raw = Pois.rawCollection();
        let distinct = Meteor.wrapAsync(raw.distinct, raw);
        return distinct('properties.category');
    },
    getStops: function (startLocation, numStops, routeChange, walking, category) {
        this.unblock();
        let requestId = this.connection.id;
        if (userRequest[requestId]) {
            if (typeof userRequest[requestId] === "object") {
                //new request check if request only changes the category
                let past = requestHistory[requestId];
                if (past.start.lat == startLocation.lat && past.start.lng == startLocation.lng
                    && past.stops === numStops && past.change === routeChange
                    && past.walking === walking) {
                    //only category has changed so we use same bus stops
                    requestHistory[requestId]["category"] = category;
                    let busCoords = past.bus;
                    userRequest[requestId] = 50;
                    userRequest[requestId] = Meteor.call('getPoi', busCoords, category, walking);
                    return userRequest[requestId];
                } else {
                    userRequest[requestId] = 0;
                }
            } else {
                return userRequest[requestId];
            }
        } else {
            userRequest[requestId] = 0;
            requestHistory[requestId] = {
                start: startLocation,
                stops: numStops,
                change: routeChange,
                walking: walking,
                category: category
            };
        }

        //initialize variables
        var results = {};
        var bus = {};
        var busComplete = {};
        var stops = {};

        function start(cb) {
            /*
            //Get all bus stops within distance of starting point
            var start = BusStops.find({
                "geometry": {
                    "$near": {
                        "$geometry": {
                            "type": "Point",
                            "coordinates": [
                                startLocation.lng,
                                startLocation.lat
                            ]
                        },
                        "$maxDistance": parseInt(walking)
                    }
                }
            }, {fields: {"id": 1, "_id": 0}}).fetch();

             //change bus stops into just bus code id

             start = getBusID(start);
             start.map((id) => {
             results[id] = null;
             });

            */

            //Get one closest bus stop from user's current location
            var start = BusStops.findOne({
                "geometry": {
                    "$near": {
                        "$geometry": {
                            "type": "Point",
                            "coordinates": [
                                startLocation.lng,
                                startLocation.lat
                            ]
                        }
                    }
                }
            }, {fields: {"id": 1, "_id": 0}});

            //change bus stops into just bus code id
            start = getBusID([start]);
            start.map((id) => {
                results[id] = null;
            });

            //get all buses for bus stop
            let temp = BusRoutes.find({
                "BusStopCode": {$in: start}
            }).fetch();
            temp.map((obj) => {
                let service = obj["ServiceNo"];
                let direction = obj["Direction"];
                let start = obj["StopSequence"];
                bus[service + "," + direction] = {
                    numStops: numStops,
                    routeChange: routeChange,
                    start: start
                }
            });

            //now bus contains all the buses to process
            //move on to check the remaining bus stops
            Object.keys(bus).map((key) => {
                let arr = key.split(",");
                let current = bus[key];
                let sequence = current.start;
                let change = current.routeChange;
                let numStops = current.numStops;

                //add origin bus to complete so not to check later
                busComplete[arr[0]] = null;

                for (let i = 1; i <= numStops; i++) {

                    let route = BusRoutes.findOne({
                        "ServiceNo": arr[0],
                        "Direction": parseInt(arr[1]),
                        "StopSequence": (sequence + i)
                    }, {fields: {"BusStopCode": 1, "_id": 0}});

                    //if bus stop exists, meaning not the end of the route yet
                    if (route) {
                        let stop = route["BusStopCode"];
                        if (!(stop in results)) {
                            results[stop] = null;
                        }


                        let tempStops = numStops - i;

                        //add bus stops to process only if there are changes and stops left

                        if (tempStops !== 0 && change !== 0) {
                            let tempChange = change - 1;
                            if (tempChange < 0) {
                                tempChange = 0;
                            } else if (tempChange > numStops) {
                                tempChange = numStops;
                            }

                            if (stops.hasOwnProperty(stop)) {
                                let prev = stops[stop];
                                if (prev.stops < tempStops) {
                                    prev.stops = tempStops;
                                    prev.change = tempChange;
                                }
                            } else {
                                stops[stop] = {
                                    change: tempChange,
                                    stops: tempStops
                                }
                            }
                        }

                    }
                }

            });
        }

        loopCount = 0;

        function loop() {
            if (Object.keys(stops).length > 0) {
                loopCount++;
                let percentage = (loopCount / routeChange) * 0.5;
                userRequest[requestId] = userRequest[requestId] + percentage;

                let stops2 = Object.assign({}, stops);
                stops = {};
                bus = {};
                let busComplete2 = {};

                //get origin routes
                Object.keys(stops2).map((key) => {
                        let routes = BusRoutes.find({
                            "BusStopCode": key,
                            "ServiceNo": {"$nin": Object.keys(busComplete)}
                        }).fetch();

                        let numStops = stops2[key].stops;
                        let routeChange = stops2[key].change;

                        routes.map((route) => {
                            let service = route["ServiceNo"];
                            let direction = route["Direction"];
                            let start = route["StopSequence"];
                            let busKey = service + "," + direction;
                            if (bus.hasOwnProperty(busKey)) {
                                let prev = bus[busKey];
                                if (prev.numStops < numStops) {
                                    bus[busKey] = {
                                        numStops: numStops,
                                        routeChange: routeChange,
                                        start: start
                                    }
                                }
                            } else {
                                busComplete2[service] = null;
                                bus[busKey] = {
                                    numStops: numStops,
                                    routeChange: routeChange,
                                    start: start
                                }
                            }

                        });
                    }
                );

                let tempCollection = new Mongo.Collection(null);
                BusRoutes.find({
                    "ServiceNo": {"$in": Object.keys(busComplete2)},
                    "BusStopCode": {"$nin": Object.keys(results)}
                }).fetch().map((data) => {
                    tempCollection.insert(data);
                });

                Object.keys(bus).map((key) => {
                        let arr = key.split(",");
                        let service = arr[0];
                        let direction = parseInt(arr[1]);
                        let route = bus[key];
                        let numStops = route.numStops;
                        let sequence = route.start;
                        let change = route.routeChange;

                        for (let i = 1; i <= numStops; i++) {
                            let stopCode = tempCollection.findOne({
                                "ServiceNo": service,
                                "Direction": direction,
                                "StopSequence": (sequence + i)
                            }, {fields: {"BusStopCode": 1, "_id": 0}});

                            if (stopCode) {
                                let stop = stopCode["BusStopCode"];
                                if (!(stop in results)) {
                                    results[stop] = null;
                                }

                                let tempStops = numStops - i;

                                //add bus stops to process only if there are changes and stops left

                                if (tempStops !== 0 && change > 0) {
                                    let tempChange = change - 1;

                                    if (stops.hasOwnProperty(stop)) {
                                        let prev = stops[stop];
                                        if (prev.stops < tempStops) {
                                            prev.stops = tempStops;
                                            prev.change = tempChange;
                                        }
                                    } else {
                                        stops[stop] = {
                                            change: tempChange,
                                            stops: tempStops
                                        }
                                    }
                                }
                            }
                        }
                    }
                );

                tempCollection = null;
                busComplete = Object.assign(busComplete, busComplete2);

                loop();
            }
        };

        start();
        userRequest[requestId] = 0.25;
        loop();
        userRequest[requestId] = 0.75;

        //now results key contains all bus stop codes that we need to search
        // we will now search the location coordinates for each bus stop
        let busCoords = Meteor.call('getBusCoords', Object.keys(results));
        requestHistory[requestId]["bus"] = busCoords;
        userRequest[requestId]  = Meteor.call('getPoi', busCoords, category, walking);
    },

    getResults: function () {
        return userRequest[this.connection.id];
    },

    getBusCoords: function (stops) {
        let arr = BusStops.find({"id": {"$in": stops}}, {fields: {"geometry.coordinates": 1}}).fetch();
        results = [];
        arr.map((val) => {
            results.push(val.geometry.coordinates);
        });
        return results;
    },

    getPoi: function (busCoords, category, walking) {
        let ids = {};
        let poi = [];
        busCoords.map((coords) => {
            let temp = Pois.find({
                "properties.category": category,
                "geometry": {
                    "$near": {
                        "$geometry": {
                            "type": "Point",
                            "coordinates": coords
                        },
                        "$maxDistance": parseInt(walking)
                    }
                }
            }).fetch();
            temp.map((obj) => {
                let id = obj._id;
                if (!ids[id]) {
                    ids[id] = true;
                    poi.push(obj);
                }
            });

        });
        return poi;
    },

    getConnection: function () {
        return this.connection;
    }
});