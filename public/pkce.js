const {BrowserWindow} = require('electron');
const Store = require('./store.js');
const Request = require('request');
const http = require('http');
const Hashes = require('jshashes');

class OauthPKCE {
    constructor(options = {}) {
        this.store = new Store({
            configName: 'user-preferences'
        });

        this.guiWindow = null;
        this.onError = (typeof options.onError == 'function') ? options.onNewToken : e => {
            return true
        };
        this.onNewToken = (typeof options.onNewToken == 'function') ? options.onNewToken : e => {
        };
        this.onRetry = (typeof options.onRetry == 'function') ? options.onNewToken : e => {
        };
        this.codeVerifierStr = this.store.get("codeVerifier");
        this.codeChallengeStr = null;
        this.retryTimeout = options.retryTimeout || 3000;
        this.refreshTokenStr = this.store.get("refreshToken");
        this.clientId = options.clientId || null;
        this.redirectUri = options.redirectUri || 'talk://login';
        this.timeRemainingTimeout = options.timeRemainingTimeout || 90;
        this.ssoBaseUrl = options.ssoBaseUrl || "https://accounts.pod.land/oauth2";
        this.scope = options.scope || "profile";
        this.redirectTrigger = null;
        this.code = null;
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
        return new Promise((resolve, reject) => {
            if (!this.code || forceLoginPage) {
                this.getCode();
                return;
            }

            this.makeRequest().then(response => {
                this.refreshTokenStr = response.refresh_token;
                this.store.set("refreshToken", response.refresh_token);
                // this.onTokenExpire((response.expires_in - this.timeRemainingTimeout) * 1000);
                resolve(response.access_token);
            }, error => {
                if (this.onError(error)) {
                    this.reset();
                    this.generateToken(true);
                }
            });
        });
    }

    refreshToken() {
        const {timeRemainingTimeout, onError} = this;
        return new Promise((resolve, reject) => {
            this.makeRequest(true).then(response => {
                this.store.set("refreshToken", this.refreshTokenStr = response.refresh_token);
                this.onTokenExpire((response.expires_in - this.timeRemainingTimeout) * 1000);
                resolve(response.access_token);
            }, error => {
                if (onError(error)) {
                    this.reset();
                    this.generateToken(true);
                }
            });
        });
    }

    onTokenExpire(timeout) {
        const {onError, onNewToken} = this;
        setTimeout(e => {
            this.refreshToken().then(onNewToken, error => {
                if (onError(error)) {
                    this.reset();
                    this.generateToken(true);
                }
            });
        }, timeout);
    }

    reset() {
        this.store.set("refreshToken", "");
        this.store.set("codeVerifier", "");
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
            } else {
                const {redirectUri, code} = this;
                baseObject = {...baseObject, ...{redirect_uri: redirectUri, code}};
            }

            const options = {
                url: `${this.ssoBaseUrl}/token`,
                form: baseObject
            };

            Request.post(options, (error, response, body) => {
                if (error) {
                    reject(JSON.parse(response));
                } else {
                    return resolve(JSON.parse(body));
                }
            });
        });
    }

    retry(isRefresh, force) {
        if (force) {
            return this.makeRequest(isRefresh);
        }
        setTimeout(e => this.makeRequest(isRefresh), this.retryTimeout);
        if (this.onRetry) {
            this.onRetry(this.retry.bind(null, isRefresh, true));
        }
    }

    getCode() {
        if(!this.codeVerifierStr) {
            this.reset();
            this.codeVerifier();
            this.codeChallenge();
        }

        this.guiWindow = new BrowserWindow({
            width: 400,
            height: 550,
            minHeight: 550,
            minWidth: 350,
            alwaysOnTop: true,
            webPreferences: {
                nodeIntegration: true
            }
        });
        this.guiWindow.removeMenu();
        this.guiWindow.loadURL(this.urlGenerator());
        this.guiWindow.restore();
        this.guiWindow.focus();
    }

    auth(config) {
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