import React, {Component} from "react";
import {PodchatJSX} from "podchatweb";
import Loading from 'react-loading-components';

import './App.css';

const electron = window.require("electron");
const ipc = electron.ipcRenderer;

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
        const self = this;

        if (!this.state.token) {
            ipc.send('noToken');
        }

        ipc.on('authToken', function (event, data) {
            self.setState({token: data.token});
        });
    }

    onNewMessage(msg, t, tid) {
        ipc.send('notify', msg.message, msg.participant.name, msg.participant.image);
        //this.chat.openThread(id)
    }

    render() {
        if (!this.state.token) {
            return (<Loading type='ball_triangle' width={100} height={100} fill='#9f456e'/>);
        }
        return (
            <div>
                <PodchatJSX token={this.state.token}
                            ref={this.chat}
                            clearCache={this.clearCache}
                            onNewMessage={this.onNewMessage}
                            customClassName={"talkDesktopWrapper"}
                            {...this.serverConfig}
                            originalServer/>
            </div>
        )
    }
}
