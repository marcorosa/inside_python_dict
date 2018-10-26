import Bootstrap from 'bootstrap/dist/css/bootstrap.min.css';
import stylesCss from './styles.css';

import * as React from 'react';
import ReactDOM from 'react-dom';

import {MyErrorBoundary, initUxSettings, BootstrapAlert} from './util';

import {faDesktop} from '@fortawesome/free-solid-svg-icons/faDesktop';
import {faSpinner} from '@fortawesome/free-solid-svg-icons/faSpinner';
import {faFirefox} from '@fortawesome/free-brands-svg-icons/faFirefox';

import {library, config as fontAwesomeConfig} from '@fortawesome/fontawesome-svg-core';
fontAwesomeConfig.autoAddCss = false;

library.add(faDesktop);
library.add(faFirefox);
library.add(faSpinner);
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';

import '@fortawesome/fontawesome-svg-core/styles.css';

function logViewportStats() {
    console.log('window: ' + window.innerWidth + 'x' + window.innerHeight);
    console.log(
        'document.documentElement: ' +
            document.documentElement.clientWidth +
            'x' +
            document.documentElement.clientHeight
    );
}

function GithubForkMe() {
    return (
        <a href="https://github.com/eleweek/inside_python_dict">
            <img
                style={{position: 'absolute', top: 0, right: 0, border: 0}}
                src="https://s3.amazonaws.com/github/ribbons/forkme_right_darkblue_121621.png"
                alt="Fork me on GitHub"
            />
        </a>
    );
}

function Alerts({isSSR, browser}) {
    const alerts = [];
    if (typeof window === 'undefined') {
        alerts.push(
            <BootstrapAlert nondismissible={true} sticky={true} alertType="info" key="js-loading">
                <FontAwesomeIcon key="js-loading-spinner" icon="spinner" spin /> JavaScript code is loading...
            </BootstrapAlert>
        );
    }
    if (browser) {
        if (browser.mobile) {
            alerts.push(
                <BootstrapAlert key="mobile-device-warning">
                    <FontAwesomeIcon icon="desktop" /> <strong>Mobile device detected.</strong> For best experience
                    desktop Chrome or Safari is recommended is recommended.
                </BootstrapAlert>
            );
        } else if (browser.name === 'firefox') {
            alerts.push(
                <BootstrapAlert key="ff-warning">
                    <FontAwesomeIcon icon={['fab', 'firefox']} /> <strong>Firefox detected.</strong> Heavy animations
                    may lag at times. If this happens, Chrome or Safari is recommended.
                </BootstrapAlert>
            );
        }
    }

    return <React.Fragment>{alerts}</React.Fragment>;
}

export class App extends React.Component {
    constructor() {
        super();
        if (global.window) {
            this.state = {
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
            };
        } else {
            this.state = {
                windowWidth: null,
                windowHeight: null,
            };
        }
    }

    windowSizeChangeHandle = () => {
        console.log('App size changed');
        logViewportStats();
        console.log(this.state);
        if (this.state.windowWidth != window.innerWidth || this.state.windowHeight != window.innerHeight) {
            this.setState({
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
            });
            this.forceUpdate();
            fixStickyResize();
        }
    };

    componentDidMount() {
        window.addEventListener('resize', this.windowSizeChangeHandle);
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.windowSizeChangeHandle);
    }

    render() {
        const {windowWidth, windowHeight} = this.state;
        let chapters = [];
        for (let [i, Chapter] of this.props.chapters.entries()) {
            chapters.push(
                <MyErrorBoundary key={`error-boundary-${i}`}>
                    <Chapter windowWidth={windowWidth} windowHeight={windowHeight} />
                </MyErrorBoundary>
            );
        }
        return (
            <div className="app-container container-fluid">
                <GithubForkMe />
                <h1> Inside python dict &mdash; an explorable explanation</h1>
                <Alerts browser={this.props.browser} />
                {chapters}
            </div>
        );
    }
}

function fixStickyResize() {
    // Generates a fake resize event that react-stickynode seems to listen to
    setTimeout(() => window.dispatchEvent(new Event('resize')), 500);
}

function fixSticky() {
    // Nudges react-stickynode just a little bit
    window.requestAnimationFrame(() => {
        window.scrollBy(0, -1);
        window.requestAnimationFrame(() => {
            window.scrollBy(0, 1);
        });
    });
}

export function initAndRender(chapters) {
    if (typeof window !== 'undefined') {
        initUxSettings();

        document.addEventListener('DOMContentLoaded', () => {
            logViewportStats();
            const root = document.getElementById('root');
            const isSSR = root.hasChildNodes();

            const props = {
                chapters,
                browser: window.insidePythonDictBrowser,
            };

            if (isSSR) {
                ReactDOM.hydrate(<App {...props} />, root);
            } else {
                ReactDOM.render(<App {...props} />, root);
            }
            // Seems to fix stickynode not stickying on page reload
            fixSticky();
        });
    }
}
