import React, {Component, useState, useEffect} from "react";
import {PodchatJSX} from "podchatweb";
import Loading from 'react-loading-components';
import {version} from '../package.json';
import CustomModal from './CustomModal';

import './App-Dark.css';
import './App.css';

const electron = window.require("electron");
const ipc = electron.ipcRenderer;

export default function App() {
    let clearCache = false,
        chatSDK = {},
        chatUser = {},
        chatAgent = {},
        connectionInterval = null,
        connectionTimeout = null,
        serverConfig = {
            socketAddress: "wss://msg.pod.land/ws",
            platformHost: "https://api.pod.land/srv/core",
            fileServer: "https://core.pod.land"
        };

    const [token, setToken] = useState(null);
    const [maximized, setMaximized] = useState(false);
    const [menuState, setMenuState] = useState(false);
    const [modalState, setModalState] = useState('');
    const [chatState, setChatState] = useState('');
    const [chatReady, setChatReady] = useState(false);
    const [nightMode, setNightMode] = useState(false);
    const [catchError, setCatchError] = useState(false);

    useEffect(() => {
        if (!token) {
            ipc.send('noToken');
        }

        ipc.on('authToken', function (event, data) {
            console.log('New Token received', data);

            setToken(data.token);
            setCatchError(false);

            setTimeout(() => {
                setToken('fwefwef');
            }, 5000);
        });

        ipc.on('nightMode', function (event, data) {
            setNightMode(data === 'true');
        });

        document.getElementsByTagName("BODY")[0].classList = (nightMode) ? 'dark-theme' : 'light-theme';
        document.getElementsByTagName("BODY")[0].style.opacity = 1;
    }, [nightMode]);

    function doLogin() {
        ipc.send('noToken');
    }

    function forceReconnect() {
        if (!chatReady) {
            chatSDK.reconnect();
            setChatState('در حال اتصال ...');
        }
    }

    function onNewMessage(msg, t, tid) {
        // if(msg.participant.id != chatUser.id) {
        //     ipc.send('notify', msg.message, msg.participant.name, msg.participant.image);
        // }
    }

    function onNotificationClick() {
        ipc.send('openTalk');
    }

    function onPodChatReady(user, chatSDK) {
        chatUser = user;
        chatSDK = chatSDK;
        chatAgent = chatSDK.chatAgent;

        setChatReady(true);

        chatSDK.onChatState = (state) => {
            switch (state.socketState) {
                case 1:
                    setChatState('');
                    setChatReady(true);
                    break;

                case 3:
                    let remaintingTime = state.timeUntilReconnect / 1000;

                    connectionInterval && clearInterval(connectionInterval);
                    connectionTimeout && clearTimeout(connectionTimeout);

                    connectionInterval = setInterval(() => {
                        if (remaintingTime > 0) {
                            setChatReady(false);
                            setChatState('اتصال بعد از ' + --remaintingTime + ' ثانیه ...');
                        }
                    }, 1000);

                    if (state.timeUntilReconnect > 0) {
                        connectionTimeout = setTimeout(() => {
                            setChatReady(false);
                            setChatState('در حال اتصال ...');
                        }, state.timeUntilReconnect);
                    }
                    break;

                default:
                    setChatState('');
                    setChatReady(false);
                    break;
            }
        };

        chatAgent.on('error', (e) => {
            setCatchError(true);
            console.log('eeeeeeeeeee', e);
            if (e && e.code && e.code == 21) {
                console.log('Get a fuckin new token');
                console.log('You dumb ass tard');
                // ipc.send('noToken');
            }
        });
    }

    function onPodChatRetry() {
        return false;
    }

    function onPodChatSignOut() {
        return false;
    }

    function minimizeWindow() {
        const window = electron.remote.getCurrentWindow();
        window.minimize();
    }

    function maximizeWindow() {
        const window = electron.remote.getCurrentWindow();

        if (maximized === true) {
            window.unmaximize();
            setMaximized(false);
        } else {
            window.maximize();
            setMaximized(true);
        }
    }

    function closeWindow() {
        const window = electron.remote.getCurrentWindow();
        window.close();
    }

    function globalMenuCloser() {
        document.getElementById('menu-wrapper').style.display = "none";
        setMenuState(false);
    }

    function globalQuitWindow() {
        ipc.send('quit-app');
    }

    function openTitlebarMenu(e) {
        e.preventDefault();
        if (menuState) {
            document.getElementById('menu-wrapper').style.display = "none";
            setMenuState(false);
        } else {
            document.getElementById('menu-wrapper').style.display = "block";
            setMenuState(true);
        }
    }

    function openModal(modalName) {
        if (modalName) {
            document.getElementById(modalName + "-modal").style.display = "flex";
            document.getElementById('menu-wrapper').style.display = "none";
            setMenuState(false);
            setModalState(modalName);
        }
    }

    function changeTheme() {
        setNightMode(!nightMode);
    }

    if (!token) {
        return (
            <div>
                <div id="login-page">
                    <Loading type='ball_triangle' width={100} height={100}
                             fill={(nightMode ? '#ffd89d' : '#7a325d')}/>
                    <button id="login-btn" onClick={doLogin}>ورود به تاک</button>
                </div>
            </div>
        );
    }

    return (
        <div>
            {
                catchError &&
                <div id="error-page">
                    <Loading type='ball_triangle' width={100} height={100}
                             fill={(nightMode ? '#ffd89d' : '#7a325d')}/>
                    <button id="login-btn" onClick={doLogin}>گزارش خطا !</button>
                </div>
            }
            <div id="title-bar">
                <div id="title-bar-menu">
                    <button id="menu-bar-btn" onClick={(e) => openTitlebarMenu(e)}>☰</button>
                    <div id="menu-wrapper">
                        <ul>
                            <li id="menu-about" onClick={() => openModal('about')}>About Talk Desktop</li>
                            <li id="menu-theme"
                                onClick={changeTheme}>Theme <span>{(nightMode) ? '☾' : '☼'}</span>
                            </li>
                            <li id="menu-quit" onClick={globalQuitWindow}>Quit Talk</li>
                        </ul>
                    </div>
                </div>
                <div id="title">T a l k &nbsp; D e s k t o p</div>
                <div id="title-bar-btns">
                    <button id="min-btn" onClick={minimizeWindow}></button>
                    <button id="max-btn" onClick={maximizeWindow}></button>
                    <button id="close-btn" onClick={closeWindow}>✕</button>
                </div>
            </div>

            <div id="content" onClick={globalMenuCloser}>
                <PodchatJSX token={token}
                    // disableNotification
                    clearCache={clearCache}
                    onNewMessage={onNewMessage}
                    onNotificationClickHook={onNotificationClick}
                    onReady={onPodChatReady}
                    onRetryHook={onPodChatRetry}
                    onSignOutHook={onPodChatSignOut}
                    customClassName={"talkDesktopWrapper"}
                    {...serverConfig}
                    originalServer/>
                {
                    !chatReady &&
                    <div id="connection-state" onClick={forceReconnect}
                         className={chatState ? 'has-content' : 'no-content'}>
                        <Loading type='puff' width={20} height={20}
                                 fill={(nightMode ? '#ffd89d' : '#7a325d')}/>
                        {chatState}
                    </div>
                }
            </div>

            <CustomModal>
                <h4>درباره تاک دسکتاپ</h4>
                <p>جهت استفاده از نسخه ی وب به آدرس
                    <a target="_blank"
                       href="https://talk.pod.land"> Talk.pod.land </a> مراجعه نمائید. این نرم افزار تحت لیسانس
                    <a target="_blank"
                       href="https://github.com/masoudmanson/talk-electron/blob/master/LICENSE"> MIT </a> می باشد.
                </p>
                <p>در صورت مواجه با هر گونه خطایی لطفا با تیم چت در ارتباط باشید.</p>
                <img src={(nightMode) ? "assets/talk-logo2.png" : "assets/talk-logo.png"}
                     alt="Talk Desktop"></img>
                <small className="version">{`Talk Desktop - Version ${version}`}</small>
            </CustomModal>
        </div>
    )
}
