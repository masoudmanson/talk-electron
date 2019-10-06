import React, {Component} from "react";
import {PodchatJSX} from "podchatweb";
// import {auth} from "podauth/src/auth";
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
        console.log('componentDidMount - Badesh man load shodam ' + new Date());
        const self = this;

        if (!this.state.token) {

            ipc.send('noToken');

            // auth({
            //     codeVerifierStr: '23fvxct43twegs34',
            //     clientId: "88413l69cd4051a039cf115ee4e073",
            //     scope: "social:write",
            //     redirectUri: "talk://login",//"http://127.0.0.1:3000",
            //     timeRemainingTimeout: 800,
            //     onNewToken: token => {
            //         this.setState({token: token});
            //     }
            // });
        }

        ipc.on('authToken', function (event, data) {
            console.log('Token came from main process', data);
            self.setState({token: data.token});
        })

        ipc.on('authCode', function (event, data) {
            // When the message is received...
            console.log('\n\n\n\nEvent', event);
            console.log('data', data);
            console.log('Message received from electron mf to react component');
            // ... change the state of this React component.
            self.setState({testValue: 'It worked!'});
        });
    }

    onNewMessage(msg, t, tid) {
        console.log('New Message Arrived', msg, t, tid);
        ipc.send('notify', msg.message, msg.participant.name, msg.participant.image);
        //this.chat.openThread(id)
    }

    render() {
        console.log('render - Akhar man load shodam ' + new Date());
        if (!this.state.token) {
            return (<Loading type='ball_triangle' width={100} height={100} fill='#c54f9c'/>);
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
