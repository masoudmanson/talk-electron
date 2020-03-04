import React, {Component} from "react";
import {PodchatJSX} from "podchatweb";

export default class App extends Component {

    constructor(props) {
        super(props);
        this.serverConfig = {
            socketAddress: "wss://msg.pod.land/ws",
            platformHost: "https://api.pod.land/srv/core",
            fileServer: "https://core.pod.land"
        };

        this.state = {
            token: null
        };

        this.refreshThreads = this.refreshThreads.bind(this);
    }

    componentDidMount() {
        const _this = this;

        ipc.on('authToken', function (event, data) {
            _this.setState({
                token: data.token
            });
        });
    }

    refreshThreads() {
        console.log('Reload Threads List');
        /*
         * Nothing happens!
         */
    }

    render() {
        return (
            <div>
                <button onClick={this.refreshThreads}>Refresh Threads</button>

                <PodchatJSX
                    {...this.serverConfig}
                    token={this.state.token}
                    refreshThreads={this.refreshThreads}
                    originalServer/>
            </div>
        )
    }
}
