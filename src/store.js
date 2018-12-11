import {observable, action} from 'mobx';

export let globalSettings = observable({
    codePlaySpeed: 1,
    maxCodePlaySpeed: 16,
});

globalSettings.setCodePlaySpeed = action(function setCodePlaySpeed(speed) {
    console.log('action setCodePlaySpeed', speed);
    globalSettings.codePlaySpeed = speed;
});

globalSettings.setMaxCodePlaySpeed = action(function setCodePlaySpeed(maxSpeed) {
    console.log('action setMaxCodePlaySpeed', maxSpeed);
    globalSettings.maxCodePlaySpeed = maxSpeed;
});

export let win = observable({
    scrollY: 0,
    height: null,
    width: null,
});

win.setScrollY = action(function setScrollY(scrollY) {
    win.scrollY = scrollY;
});

win.setWH = action(function setWH(w, h) {
    console.log('setWH', w, h);
    win.width = w;
    win.height = h;
});
