import React from "react"
import ReactDOM from "react-dom"
import { Router, Route, Link, IndexRoute, browserHistory } from "react-router"

import App from './App.jsx';

export const Routes = () => {
    return (
        <Router history={browserHistory}>
            <Route path="/" component={App}></Route>
        </Router>
    )
};

Meteor.startup(function () {
    WebFontConfig = {
        google: {families: ['Roboto Slab:400,300,500:latin']}
    };
    (function () {
        var wf = document.createElement('script');
        wf.src = ('https:' == document.location.protocol ? 'https' : 'http') +
            '://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js';
        wf.type = 'text/javascript';
        wf.async = 'true';
        var s = document.getElementsByTagName('script')[0];
        s.parentNode.insertBefore(wf, s);
        //console.log("async fonts loaded", WebFontConfig);
    })();

    ReactDOM.render(<Routes />, document.getElementById('App'));

});