import React, {Component} from "react";
import {PodchatJSX} from "podchatweb";
import {auth} from "podauth";
import './App.css';

export default class App extends Component {

    constructor(props) {
        super(props);
        this.clearCache = false;
        this.serverConfig = {
            socketAddress: "wss://msg.pod.land/ws",
            platformHost: "https://api.pod.land/srv/core",
            fileServer: "https://core.pod.land"
        };
        this.state = {
            token: null
        };
    }

    componentDidMount() {
        if (!this.state.token) {
            auth({
                clientId: "88413l69cd4051a039cf115ee4e073",
                scope: "social:write",
                redirectUri: "http://127.0.0.1:3000",
                timeRemainingTimeout: 800,
                onNewToken: token => {
                    this.setState({token: token});
                }
            });
        }
    }

    onNewMessage(msg) {
        console.log('fuckin shit arried', msg);

        // let myNotification = new Notification(msg.participant.name, {
        //     body: msg.message
        // })
    }

    render() {
        if (!this.state.token) {
            return (<div>Loading ...</div>);
        }
        return (
            <div>
                <PodchatJSX token={this.state.token}
                            clearCache={this.clearCache}
                            onNewMessage={this.onNewMessage}
                            customClassName={"talkDesktopWrapper"}
                            {...this.serverConfig}
                            originalServer/>
            </div>
        )
    }
}
