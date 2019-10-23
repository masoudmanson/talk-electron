import React, {Component} from "react";
import {PodchatJSX} from "podchatweb";
import Loading from 'react-loading-components';
import CustomModal from './CustomModal';

import './App-Dark.css';
import './App.css';

const electron = window.require("electron");
const ipc = electron.ipcRenderer;

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            info: null
        };
    }

    componentDidCatch(error, info) {
        this.setState({
            hasError: true,
            error: error,
            info: info
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div>
                    <h1>Oops, something went wrong :(</h1>
                    <p>The error: {this.state.error.toString()}</p>
                    <p>Where it occured: {this.state.info.componentStack}</p>
                </div>
            );
        }
        return this.props.children;
    }
}

export default class App extends Component {

    constructor(props) {
        super(props);
        this.clearCache = false;
        this.chatSDK = {};
        this.chatUser = {};
        this.connectionInterval = null;
        this.connectionTimeout = null;
        this.serverConfig = {
            socketAddress: "wss://msg.pod.land/ws",
            platformHost: "https://api.pod.land/srv/core",
            fileServer: "https://core.pod.land"
        };
        this.state = {
            token: null,
            maximized: false,
            menuState: false,
            modalState: '',
            chatState: '',
            chatReady: false,
            nightMode: false,
            catchError: false,
            catchErrorMessage: '',
            version: ''
        };
        this.onPodChatReady = this.onPodChatReady.bind(this);
        this.forceReconnect = this.forceReconnect.bind(this);
        this.maximizeWindow = this.maximizeWindow.bind(this);
        this.openTitlebarMenu = this.openTitlebarMenu.bind(this);
        this.globalMenuCloser = this.globalMenuCloser.bind(this);
        this.openModal = this.openModal.bind(this);
        this.changeTheme = this.changeTheme.bind(this);
        this.onNewMessage = this.onNewMessage.bind(this);
        this.onPodChatRetry = this.onPodChatRetry.bind(this);
        this.onPodChatSignOut = this.onPodChatSignOut.bind(this);
        this.onNotificationClick = this.onNotificationClick.bind(this);
    }

    componentDidMount() {
        const self = this;

        if (!this.state.token) {
            ipc.send('noToken');
        }

        ipc.send('app-version');

        ipc.on('app-version', function (event, data) {
            self.setState({
                version: data.version
            });
        });

        ipc.on('authToken', function (event, data) {
            console.log('New Token received', data);

            self.setState({
                token: data.token,
                catchError: false
            });

            // setTimeout(() => {
            //     // console.log('[✕] Token has been Revoked!');
            //     // throw new Error('Error error error');
            //     // self.setState({token: new Date().getTime()});
            // }, 5000);
        });

        ipc.on('nightMode', function (event, data) {
            self.setState({nightMode: data === 'true'}, () => {
                document.getElementsByTagName("BODY")[0].className = (self.state.nightMode) ? 'dark-theme' : 'light-theme';
            });
        });

        document.getElementsByTagName("BODY")[0].classList = (this.state.nightMode) ? 'dark-theme' : 'light-theme';
        document.getElementsByTagName("BODY")[0].style.opacity = 1;

        const notification = document.getElementById('notification');
        const message = document.getElementById('message');
        const restartButton = document.getElementById('restart-button');

        ipc.on('update-available', () => {
            ipc.removeAllListeners('update-available');
            message.innerText = 'A new update is available. Downloading now...';
            notification.classList.remove('hidden');
        });

        ipc.on('update-downloaded', () => {
            ipc.removeAllListeners('update-downloaded');
            message.innerText = 'Update Downloaded. It will be installed on restart. Restart now?';
            restartButton.classList.remove('hidden');
            notification.classList.remove('hidden');
        });
    }

    closeNotification() {
        // notification.classList.add('hidden');
    }

    restartApp() {
        ipc.send('restart-app');
    }

    doLogin() {
        ipc.send('noToken');
    }

    forceReconnect() {
        if (!this.state.chatReady) {
            this.chatSDK.reconnect();
            this.setState({chatState: 'در حال اتصال ...'});
        }
    }

    onNewMessage(msg, t, tid) {
        // if(msg.participant.id != this.chatUser.id) {
        //     ipc.send('notify', msg.message, msg.participant.name, msg.participant.image);
        // }
    }

    onNotificationClick() {
        ipc.send('openTalk');
    }

    onPodChatReady(user, chatSDK) {
        this.chatSDK = chatSDK;
        this.chatUser = user;
        this.chatAgent = chatSDK.chatAgent;

        this.setState({chatReady: true});

        chatSDK.onChatState = (state) => {
            switch (state.socketState) {
                case 1:
                    this.setState({chatState: '', chatReady: true});
                    break;

                case 3:
                    let remaintingTime = state.timeUntilReconnect / 1000;

                    this.connectionInterval && clearInterval(this.connectionInterval);
                    this.connectionTimeout && clearTimeout(this.connectionTimeout);

                    this.connectionInterval = setInterval(() => {
                        if (remaintingTime > 0) {
                            this.setState({
                                chatReady: false,
                                chatState: 'اتصال بعد از ' + --remaintingTime + ' ثانیه ...'
                            });
                        }
                    }, 1000);

                    if (state.timeUntilReconnect > 0) {
                        this.connectionTimeout = setTimeout(() => {
                            this.setState({chatReady: false, chatState: 'در حال اتصال ...'});
                        }, state.timeUntilReconnect);
                    }
                    break;

                default:
                    this.setState({chatReady: false, chatState: ''});
                    break;
            }
        };

        this.chatAgent.on('error', (e) => {
            this.setState({catchError: true, catchErrorMessage: (e && e.message && e.message.length) ? e.message : ''});

            if (e && e.code && e.code == 21) {
                ipc.send('noToken');
            }
        });
    }

    onPodChatRetry() {
        return false;
    }

    onPodChatSignOut() {
        return false;
    }

    minimizeWindow() {
        const window = electron.remote.getCurrentWindow();
        window.minimize();
    }

    maximizeWindow() {
        const window = electron.remote.getCurrentWindow();

        if (this.state.maximized === true) {
            window.unmaximize();
            this.setState({maximized: false});
        } else {
            window.maximize();
            this.setState({maximized: true});
        }
    }

    closeWindow() {
        const window = electron.remote.getCurrentWindow();
        window.close();
    }

    globalMenuCloser() {
        document.getElementById('menu-wrapper').style.display = "none";
        this.setState({menuState: false});
    }

    globalQuitWindow() {
        ipc.send('quit-app');
    }

    openTitlebarMenu(e) {
        e.preventDefault();
        if (this.state.menuState) {
            document.getElementById('menu-wrapper').style.display = "none";
            this.setState({menuState: false});
        } else {
            document.getElementById('menu-wrapper').style.display = "block";
            this.setState({menuState: true});
        }
    }

    openModal(modalName) {
        if (modalName) {
            document.getElementById(modalName + "-modal").style.display = "flex";
            document.getElementById('menu-wrapper').style.display = "none";
            this.setState({menuState: false});
            this.setState({modalState: modalName});
        }
    }

    changeTheme() {
        this.setState({nightMode: !this.state.nightMode}, () => {
            ipc.send('nightMode', this.state.nightMode);
            document.getElementsByTagName("BODY")[0].className = (this.state.nightMode) ? 'dark-theme' : 'light-theme';
            this.globalMenuCloser();
        });
    }

    render() {
        if (!this.state.token) {
            return (
                <div>
                    <div id="login-page">
                        <Loading type='ball_triangle' width={100} height={100}
                                 fill={(this.state.nightMode ? '#ffd89d' : '#7a325d')}/>
                        <button id="login-btn" onClick={this.doLogin}>ورود به تاک</button>
                    </div>
                </div>
            );
        }

        return (
            <ErrorBoundary>
                <div>
                    <div id="notification" className="hidden">
                        <p id="message"></p>
                        <button id="close-button" onClick={this.closeNotification}>
                            Close
                        </button>
                        <button id="restart-button" onClick={this.restartApp} className="hidden">
                            Restart
                        </button>
                    </div>

                    {
                        this.state.catchError &&
                        <div id="error-page">
                            <Loading type='puff' width={50} height={50}
                                     fill={(this.state.nightMode ? '#ffd89d' : '#7a325d')}/>
                            {this.state.catchErrorMessage &&
                            <p dir="auto" className={'error-message'}>{this.state.catchErrorMessage}</p>}
                            <button id="login-btn" onClick={this.doLogin}>تلاش دوباره</button>
                        </div>
                    }
                    <div id="title-bar">
                        <div id="title-bar-menu">
                            <button id="menu-bar-btn" onClick={(e) => this.openTitlebarMenu(e)}>☰</button>
                            <div id="menu-wrapper">
                                <ul>
                                    <li id="menu-about" onClick={() => this.openModal('about')}>About Talk Desktop</li>
                                    <li id="menu-theme"
                                        onClick={this.changeTheme}>Theme <span>{(this.state.nightMode) ? '☾' : '☼'}</span>
                                    </li>
                                    <li id="menu-quit" onClick={this.globalQuitWindow}>Quit Talk</li>
                                </ul>
                            </div>
                        </div>
                        <div id="title">T a l k &nbsp; D e s k t o p</div>
                        <div id="title-bar-btns">
                            <button id="min-btn" onClick={this.minimizeWindow}></button>
                            <button id="max-btn" onClick={this.maximizeWindow}></button>
                            <button id="close-btn" onClick={this.closeWindow}>✕</button>
                        </div>
                    </div>

                    <div id="content" onClick={this.globalMenuCloser}>
                        <PodchatJSX
                            // disableNotification
                            token={this.state.token}
                            clearCache={this.clearCache}
                            onNewMessage={this.onNewMessage}
                            onNotificationClickHook={this.onNotificationClick}
                            openThread={this.openThread}
                            onReady={this.onPodChatReady}
                            onRetryHook={this.onPodChatRetry}
                            onSignOutHook={this.onPodChatSignOut}
                            customClassName={"talkDesktopWrapper"}
                            {...this.serverConfig}
                            originalServer/>
                        {
                            !this.state.chatReady &&
                            <div id="connection-state" onClick={this.forceReconnect}
                                 className={this.state.chatState ? 'has-content' : 'no-content'}>
                                <Loading type='puff' width={20} height={20}
                                         fill={(this.state.nightMode ? '#ffd89d' : '#7a325d')}/>
                                {this.state.chatState}
                            </div>
                        }
                    </div>

                    <CustomModal>
                        <h4>درباره تاک دسکتاپ</h4>
                        <p>جهت استفاده از نسخه ی وب به آدرس
                            <a target="_blank"
                               href="https://talk.pod.land"> Talk.pod.land </a> مراجعه نمائید. این نرم افزار تحت لیسانس
                            <a target="_blank"
                               href="https://github.com/masoudmanson/talk-electron/blob/master/LICENSE"> MIT </a> می
                            باشد.
                        </p>
                        <p>در صورت مواجه با هر گونه خطایی لطفا با تیم چت در ارتباط باشید.</p>
                        <img src={(this.state.nightMode) ? "assets/talk-logo2.png" : "assets/talk-logo.png"}
                             alt="Talk Desktop"></img>
                        <small className="version">{`Talk Desktop - Version ${this.state.version}`}</small>
                    </CustomModal>
                </div>
            </ErrorBoundary>
        )
    }
}
