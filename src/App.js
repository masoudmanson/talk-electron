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

        this.reloadApp = this.reloadApp.bind(this);
        this.closeApp = this.closeApp.bind(this);
    }

    componentDidCatch(error, info) {
        this.setState({
            hasError: true,
            error: error,
            info: info
        });
    }

    reloadApp() {
        const window = electron.remote.getCurrentWindow();
        window.reload();
    }

    closeApp() {
        ipc.send('quit-app');
    }

    render() {
        if (this.state.hasError) {
            return (
                <div id="error-page">
                    <p dir="auto" className={'error-message'}>خطائی رخ داده است. لطفا دوباره تلاش نمائید!</p>
                    <button id="login-btn" onClick={this.reloadApp}>تلاش دوباره</button>
                    <p id="main-close-btn" onClick={this.closeApp}>بستن تاک</p>
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
        this.chatAgent = {};
        this.chatUser = {};
        this.podChatWeb = {};
        this.connectionInterval = null;
        this.connectionTimeout = null;
        this.serverConfig = {
            // M A I N   S E R V E R
            socketAddress: "wss://msg.pod.ir/ws",
            platformHost: "https://api.pod.ir/srv/core",
            fileServer: "https://core.pod.ir"
            // S A N D B O X
            // socketAddress: "wss://chat-sandbox.pod.ir/ws",
            // platformHost: "https://sandbox.pod.ir:8043/srv/basic-platform",
            // fileServer: "https://core.pod.ir"
        };

        this.state = {
            token: null,
            maximized: false,
            menuState: false,
            modalState: '',
            chatConnecting: false,
            chatState: '',
            chatReady: false,
            nightMode: false,
            authError: false,
            catchError: false,
            catchErrorMessage: '',
            catchErrorBtn: true,
            version: '',
            updateNotification: false,
            updateNotificationCompleted: false,
            updateNotificationMessage: ''
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
        this.closeNotification = this.closeNotification.bind(this);
        this.refreshTokenAndSocket = this.refreshTokenAndSocket.bind(this);
        this.restartApp = this.restartApp.bind(this);
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
            self.setState({
                token: data.token,
                catchError: false,
                authError: false
            });
        });

        ipc.on('authError', function (event, data) {
            self.setState({
                authError: true
            });
        });

        ipc.on('nightMode', function (event, data) {
            self.setState({nightMode: data === 'true'}, () => {
                document.getElementsByTagName("BODY")[0].className = (self.state.nightMode) ? 'dark-theme' : 'light-theme';
            });
        });

        document.getElementsByTagName("BODY")[0].classList = (this.state.nightMode) ? 'dark-theme' : 'light-theme';
        document.getElementsByTagName("BODY")[0].style.opacity = 1;

        ipc.on('update-available', () => {
            ipc.removeAllListeners('update-available');
            this.setState({
                updateNotification: true,
                updateNotificationMessage: 'دریافت نسخه‌ی جدید ...'
            });
        });

        ipc.on('update-downloaded', () => {
            ipc.removeAllListeners('update-downloaded');

            this.setState({
                updateNotification: true,
                updateNotificationCompleted: true,
                updateNotificationMessage: 'نسخه‌ی جدید آماده‌ی نصب می باشد.'
            });
        });
    }

    closeNotification() {
        this.setState({
            updateNotification: false
        });
    }

    refreshTokenAndSocket() {
        // this.doLogin();
        // this.forceReconnect();

        ipc.send('relunch-app');
    }

    restartApp() {
        this.setState({
            catchError: true,
            catchErrorMessage: 'نسخه‌ی جدید در حال بررسی می باشد. لطفا شکیبا باشید.',
            catchErrorBtn: false
        });
        ipc.send('restart-app');
    }

    doLogin() {
        ipc.send('noToken');
    }

    forceReconnect() {
        // TODO: Check to see if this if statement is needed or not?
        // if (!this.state.chatReady) {
            this.chatSDK.reconnect();
            this.setState({
                chatState: 'در حال اتصال ...',
                chatConnecting: true,
                authError: false
            });
        // }
    }

    onNewMessage(msg, t, tid) {
        if (parseInt(msg.participant.id) !== parseInt(this.chatUser.id)) {
            ipc.send('notify', msg.message, msg.participant.name, msg.participant.image);
        }
    }

    onNotificationClick() {
        ipc.send('openTalk');
    }

    onPodChatReady(user, chatSDK, podChatWebThis) {
        this.chatSDK = chatSDK;
        this.chatUser = user;
        this.chatAgent = chatSDK.chatAgent;
        this.podChatWeb = podChatWebThis;

        this.setState({chatReady: true});

        chatSDK.onChatState = (state) => {
            switch (state.socketState) {
                case 1:
                    this.setState({chatState: '', chatReady: true});
                    if(typeof this.podChatWeb.refreshThreads === "function") {
                        this.podChatWeb.refreshThreads();
                    }
                    break;

                case 3:
                    let remaintingTime = state.timeUntilReconnect / 1000;

                    this.connectionInterval && clearInterval(this.connectionInterval);
                    this.connectionTimeout && clearTimeout(this.connectionTimeout);

                    this.connectionInterval = setInterval(() => {
                        if (remaintingTime > 0) {
                            this.setState({
                                chatReady: false,
                                chatConnecting: false,
                                chatState: 'اتصال بعد از ' + --remaintingTime + ' ثانیه ...'
                            });
                        }
                    }, 1000);

                    if (state.timeUntilReconnect > 0) {
                        this.connectionTimeout = setTimeout(() => {
                            this.setState({
                                chatReady: false,
                                chatConnecting: true,
                                chatState: 'در حال اتصال ...'
                            });
                        }, state.timeUntilReconnect);
                    }
                    break;

                default:
                    this.setState({
                        chatReady: false,
                        chatState: '',
                        chatConnecting: false
                    });
                    break;
            }
        };

        this.chatAgent.on('error', (e) => {
            // this.setState({
            //     catchError: true,
            //     catchErrorMessage: (e && e.message && e.message.length) ? e.message : ''
            // });

            if (e && e.code && e.code === 21) {
                ipc.send('noToken');
            }
        });
    }

    onPodChatRetry() {
        /*
         * This is what that happens at PodChatWeb,
         * So inorder to satisfy the situation
         * We have to return a Promise
         * And pass the Token to it
         *
         * chatRetryHook().then(token => {
         *   chatInstance.setToken(token);
         *   chatInstance.reconnect();
         * });
         *
         */

        return Promise.resolve(this.state.token);
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
                        <div>
                            <button id="login-btn" onClick={this.doLogin}>ورود به تاک</button>
                            <p id="main-close-btn" onClick={this.globalQuitWindow}>بستن تاک</p>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <ErrorBoundary>
                <div>
                    {
                        this.state.catchError &&
                        <div id="error-page">
                            <Loading type='puff' width={50} height={50}
                                     fill={(this.state.nightMode ? '#ffd89d' : '#7a325d')}/>
                            {
                                this.state.catchErrorMessage &&
                                <p dir="auto" className={'error-message'}>{this.state.catchErrorMessage}</p>
                            }

                            {
                                this.state.catchErrorBtn &&
                                <button id="login-btn" onClick={this.refreshTokenAndSocket}>تلاش دوباره</button>
                            }
                        </div>
                    }

                    <div id="title-bar">
                        <div id="title-bar-menu">
                            <button id="menu-bar-btn" onClick={(e) => this.openTitlebarMenu(e)}>☰</button>
                            <div id="menu-wrapper">
                                <ul>
                                    <li id="menu-about"
                                        onClick={() => this.openModal('about')}>درباره تاک
                                    </li>
                                    <li id="menu-theme"
                                        onClick={this.changeTheme}>حالت شب
                                    </li>
                                    <li id="menu-quit"
                                        onClick={this.globalQuitWindow}>خروج از تاک
                                    </li>
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
                            // openThread={this.openThread}
                            token={this.state.token}
                            clearCache={this.clearCache}
                            onNewMessage={this.onNewMessage}
                            onNotificationClickHook={this.onNotificationClick}
                            onReady={this.onPodChatReady}
                            onRetryHook={this.onPodChatRetry}
                            onSignOutHook={this.onPodChatSignOut}
                            customClassName={"talkDesktopWrapper"}
                            {...this.serverConfig}
                            originalServer/>

                        {
                            (!this.state.chatReady && !this.state.authError) &&
                            <div id="connection-state"
                                 className={(this.state.chatState ? 'has-content status-messages' : 'no-content status-messages')}
                                 style={{
                                     bottom: (this.state.updateNotification) ? 60 : 10
                                 }}>
                                <Loading type='puff' width={20} height={20}
                                         fill={(this.state.nightMode ? '#ffd89d' : '#7a325d')}/>
                                {this.state.chatState}
                                {
                                    (!this.state.chatConnecting && this.state.chatState) &&
                                    <span onClick={this.forceReconnect}>تلاش مجدد</span>
                                }
                            </div>
                        }

                        {
                            this.state.updateNotification &&
                            <div id="notification" className="has-content status-messages">
                                <Loading type='puff' width={20} height={20}
                                         fill={(this.state.nightMode ? '#ffd89d' : '#7a325d')}/>
                                {this.state.updateNotificationMessage}
                                {
                                    this.state.updateNotificationCompleted ?
                                        <span onClick={this.restartApp}>شروع مجدد</span>
                                        :
                                        <span onClick={this.closeNotification}>بستن</span>
                                }
                            </div>
                        }

                        {
                            this.state.authError &&
                            <div id="connection-state" className="has-content status-messages">
                                <Loading type='puff' width={20} height={20}
                                         fill={(this.state.nightMode ? '#ffd89d' : '#7a325d')}/>
                                خطائی رخ داد!
                                <span onClick={this.refreshTokenAndSocket}>تلاش مجدد</span>
                            </div>
                        }
                    </div>

                    <CustomModal>
                        <h4>درباره تاک دسکتاپ</h4>
                        <p>جهت استفاده از نسخه ی وب به آدرس
                            <a target="_blank"
                               rel="noopener noreferrer"
                               href="https://talk.pod.ir"> Talk.pod.ir </a> مراجعه نمائید. این نرم افزار تحت لیسانس
                            <a target="_blank"
                               rel="noopener noreferrer"
                               href="https://github.com/masoudmanson/talk-electron/blob/master/LICENSE"> MIT </a> می
                            باشد.
                        </p>
                        <p>در صورت مواجه با هر گونه خطایی لطفا با تیم چت در ارتباط باشید.</p>
                        {/*<img src={(this.state.nightMode) ? "assets/talk-logo2.png" : "assets/talk-logo.png"}*/}
                        {/*alt="Talk Desktop"></img>*/}
                        <small className="version">{`Talk Desktop - Version ${this.state.version}`}</small>
                    </CustomModal>
                </div>
            </ErrorBoundary>
        )
    }
}
