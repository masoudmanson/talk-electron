const {BrowserWindow} = require('electron');
const Store = require('./store.js');
const Request = require('request');
const Hashes = require('jshashes');

class OauthPKCE {
    constructor(options = {}) {
        this.store = new Store({
            configName: 'user-preferences',
            defaults: {
                windowBounds: {width: 1200, height: 700},
                codeVerifier: null,
                refreshToken: null,
                nightMode: false
            }
        });

        this.guiWindow = null;
        this.onError = (typeof options.onError == 'function') ? options.onError : e => {
            return true;
        };
        this.onNewToken = (typeof options.onNewToken == 'function') ? options.onNewToken : e => {
        };
        this.onRetry = (typeof options.onRetry == 'function') ? options.onRetry : e => {
        };
        this.codeVerifierStr = this.store.get("codeVerifier");
        this.codeChallengeStr = null;
        this.retryTimeout = options.retryTimeout || 5000;
        this.retryCount = options.retryCount || 5;
        this.refreshTokenStr = this.store.get("refreshToken");
        this.clientId = options.clientId || null;
        this.redirectUri = options.redirectUri || 'talk://login';
        this.timeRemainingTimeout = options.timeRemainingTimeout || 90;
        this.ssoBaseUrl = options.ssoBaseUrl || "https://accounts.pod.ir/oauth2";
        this.scope = options.scope || "profile";
        this.redirectTrigger = null;
        this.code = null;
        this.onTokenExpireTimeout = null;
        this.globalTimeoutInterval = null;
        this.globalRetryCount = 0;
    }

    urlGenerator() {
        return `${this.ssoBaseUrl}/authorize/index.html?client_id=${this.clientId}&response_type=code&redirect_uri=${this.redirectUri}&code_challenge_method=S256&code_challenge=${this.codeChallengeStr}&scope=${this.scope}`;
    }

    codeVerifier() {
        const codeVerifierStrRand = randomString(10);
        this.store.set("codeVerifier", codeVerifierStrRand);
        this.codeVerifierStr = codeVerifierStrRand;
    }

    codeChallenge() {
        return this.codeChallengeStr = new Hashes.SHA256().b64(this.codeVerifierStr).replace(/\+/g, "-").replace(/\//g, "_").replace(/\=+$/, "");
    }

    generateToken(forceLoginPage) {
        var _this = this;
        return new Promise((resolve, reject) => {
            if (!this.code || forceLoginPage) {
                this.getCode();
                return;
            }

            this.makeRequest().then(response => {
                if (response.statusCode === 200) {
                    try {
                        let result = JSON.parse(response.body);

                        if (result.access_token) {
                            this.refreshTokenStr = result.refresh_token;
                            this.store.set("refreshToken", result.refresh_token);
                            this.onTokenExpire((result.expires_in - this.timeRemainingTimeout) * 1000);
                            resolve(result.access_token);
                        }
                    } catch(e) {
                        console.log(e);
                    }
                } else {
                    this.getCode();
                    return;
                }
            }, error => {
                if(++this.globalRetryCount < this.retryCount) {
                    this.globalTimeoutInterval && clearTimeout(this.globalTimeoutInterval);
                    this.globalTimeoutInterval == setTimeout(function () {
                        _this.generateToken();
                    }, this.retryTimeout);
                } else {
                    this.globalRetryCount = 0;
                    this.onError(error);
                }
            });
        });
    }

    refreshToken() {
        var _this = this;
        return new Promise((resolve, reject) => {
            this.makeRequest(true).then(response => {
                if (response.statusCode === 200) {
                    try {
                        let result = JSON.parse(response.body);

                        if (result.refresh_token) {
                            this.refreshTokenStr = result.refresh_token;
                            this.store.set("refreshToken", result.refresh_token);
                            this.onTokenExpire((result.expires_in - this.timeRemainingTimeout) * 1000);
                            resolve(result.access_token);
                        }
                    } catch(e) {
                        console.log(e);
                    }
                } else {
                    this.getCode();
                    return;
                }
            }, error => {
                if(++this.globalRetryCount < this.retryCount) {
                    this.globalTimeoutInterval && clearTimeout(this.globalTimeoutInterval);
                    this.globalTimeoutInterval == setTimeout(function () {
                        _this.refreshToken();
                    }, this.retryTimeout);
                } else {
                    this.globalRetryCount = 0;
                    this.onError(error);
                }
            });
        });
    }

    onTokenExpire(timeout) {
        var _this = this;
        const {onError, onNewToken} = this;
        _this.onTokenExpireTimeout && clearTimeout(_this.onTokenExpireTimeout);
        _this.onTokenExpireTimeout = setTimeout(e => {
            _this.refreshToken().then(onNewToken, error => {
                _this.onTokenExpire(5000);
            });
        }, timeout);
    }

    reset() {
        try {
            this.store.set("refreshToken", "");
            this.refreshTokenStr = '';
            this.store.set("codeVerifier", "");
            this.codeVerifierStr = '';
        } catch (e) {
            consolle.log(e);
        }
    }

    signOut() {
        this.reset();
        this.generateToken(true);
    }

    setCode(code) {
        this.code = code;
        if (this.refreshTokenStr) {
            return this.refreshToken().then(this.onNewToken);
        }

        return this.generateToken().then(this.onNewToken);
    }

    makeRequest(isRefresh) {
        return new Promise((resolve, reject) => {
            var baseObject = {
                grant_type: isRefresh ? "refresh_token" : "authorization_code",
                client_id: this.clientId,
                code_verifier: this.codeVerifierStr
            };

            if (isRefresh) {
                const {refreshTokenStr} = this;
                baseObject = {...baseObject, ...{refresh_token: refreshTokenStr}};
                // baseObject = {...baseObject, ...{refresh_token: 'fwrr23rf234'}};
            } else {
                const {redirectUri, code, refreshTokenStr} = this;
                baseObject = {...baseObject, ...{refresh_token: refreshTokenStr, redirect_uri: redirectUri, code}};
            }

            const options = {
                url: `${this.ssoBaseUrl}/token`,
                form: baseObject,
                strictSSL: false
            };

            Request.post(options, (error, response, body) => {
                if (error) {
                    return reject(error);
                } else {
                    return resolve(response);
                }
            });
        });
    }

    retry(isRefresh, force) {
        var _this = this;
        if (force) {
            return this.makeRequest(isRefresh);
        }
        setTimeout(e => {
            _this.makeRequest(isRefresh);
        }, _this.retryTimeout);
        if (this.onRetry) {
            this.onRetry(this.retry.bind(null, isRefresh, true));
        }
    }

    getCode() {
        this.reset();
        this.codeVerifier();
        this.codeChallenge();

        if (!this.guiWindow) {
            this.guiWindow = new BrowserWindow({
                width: 400,
                height: 620,
                minHeight: 600,
                minWidth: 400,
                alwaysOnTop: true,
                webPreferences: {
                    nodeIntegration: true
                }
            });

            this.guiWindow.removeMenu();
            // this.guiWindow.webContents.openDevTools();

            this.guiWindow.loadURL(this.urlGenerator());
            this.guiWindow.on("closed", () => (this.guiWindow = null));
        } else {
            this.guiWindow.loadURL(this.urlGenerator());
        }

        this.guiWindow.restore();
        this.guiWindow.focus();
    }

    auth() {
        this.globalRetryCount = 0;

        if (!this.code) {
            this.getCode();
            return;
        }
        else {
            if (this.refreshTokenStr) {
                return this.refreshToken().then(this.onNewToken);
            }
            return this.generateToken().then(this.onNewToken);
        }
    }
}

function randomString(length) {
    var randomChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    var i, rn, rnd = '';

    for (i = 1; i <= length; i++) {
        rnd += randomChars.substring(rn = Math.floor(Math.random() * randomChars.length), rn + 1);
    }
    return rnd;
}

module.exports = OauthPKCE;
