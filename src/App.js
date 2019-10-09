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
        this.chatSDK = {};
        this.connectionInterval = null;
        this.connectionTimeout = null;
        this.serverConfig = {
            socketAddress: "wss://msg.pod.land/ws",
            platformHost: "https://api.pod.land/srv/core",
            fileServer: "https://core.pod.land"
        };
        this.state = {
            token: null,
            chatState: ''
        };
        this.onPodChatReady = this.onPodChatReady.bind(this);
        this.forceReconnect = this.forceReconnect.bind(this);
    }

    componentDidMount() {
        const self = this;

        if (!this.state.token) {
            console.log('Get a damn token');
            ipc.send('noToken');
        }

        ipc.on('authToken', function (event, data) {
            console.log('Your fuckin token', data);
            self.setState({token: data.token});
        });
    }

    componentDidUpdate() {
    }

    doLogin() {
        ipc.send('noToken');
    }

    forceReconnect() {
        this.chatSDK.reconnect();
        this.setState({chatState: 'در حال اتصال ...'});
    }

    onNewMessage(msg, t, tid) {
        ipc.send('notify', msg.message, msg.participant.name, msg.participant.image);
    }

    onPodChatReady(user, chatSDK) {
        this.chatSDK = chatSDK;

        chatSDK.onChatState = (state) => {
            switch (state.socketState) {
                case 1:
                    this.setState({chatState: ''});
                    break;

                case 3:
                    let remaintingTime = state.timeUntilReconnect / 1000;

                    this.connectionInterval && clearInterval(this.connectionInterval);
                    this.connectionTimeout && clearTimeout(this.connectionTimeout);

                    this.connectionInterval = setInterval(() => {
                        if (remaintingTime > 0) {
                            this.setState({chatState: 'اتصال بعد از ' + --remaintingTime + ' ثانیه ...'});
                        }
                    }, 1000);

                    if (state.timeUntilReconnect > 0) {
                        this.connectionTimeout = setTimeout(() => {
                            this.setState({chatState: 'در حال اتصال ...'});
                        }, state.timeUntilReconnect);
                    }
                    break;

                default:
                    this.setState({chatState: ''});
                    break;
            }
        };
    }

    render() {
        if (!this.state.token) {
            return (
                <div id="login-page">
                    <Loading type='ball_triangle' width={100} height={100} fill='#9f456e'/>
                    <button id="login-btn" onClick={this.doLogin}>ورود به تاک</button>
                </div>
            );
        }
        return (
            <div>
                <PodchatJSX token={this.state.token}
                            clearCache={this.clearCache}
                            onNewMessage={this.onNewMessage}
                            onReady={this.onPodChatReady}
                            customClassName={"talkDesktopWrapper"}
                            {...this.serverConfig}
                            originalServer/>
                {
                    this.state.chatState && <div id="connection-state" onClick={this.forceReconnect}>{this.state.chatState}</div>
                }
            </div>
        )
    }
}
