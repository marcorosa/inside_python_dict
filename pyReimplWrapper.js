const net = require('net');
const split = require('split');
import 'ignore-styles';

import {BigNumber} from 'bignumber.js';
import {DUMMY, None} from './src/hash_impl_common';
import {Dict32} from './src/chapter4_real_python_dict';
import {Slot} from './src/chapter3_and_4_common';
import {List} from 'immutable';

function parseSimplePyObj(obj) {
    if (obj === null || typeof obj === 'number' || typeof obj === 'string') {
        return obj;
    } else if (typeof obj === 'object' && obj.type === 'None') {
        let res = None;
        res._hashCode = obj.hash;
        return res;
    } else if (typeof obj === 'object' && obj.type === 'DUMMY') {
        return DUMMY;
    } else {
        throw new Error(`Unknown obj ${JSON.stringify(obj)}`);
    }
}

function dumpSimplePyObj(obj) {
    if (obj === DUMMY) {
        return {
            type: 'DUMMY',
        };
    } else if (obj === None) {
        return {
            type: 'None',
        };
    } else {
        return obj;
    }
}

function restorePyDictState(state) {
    let {pySelf} = Dict32.__init__();
    if (state.slots != null) {
        pySelf = pySelf.set(
            'slots',
            new List(
                state.slots.map(slot => {
                    let key = parseSimplePyObj(slot.key);
                    let value = parseSimplePyObj(slot.value);

                    return Slot({
                        hashCode: slot.hashCode ? new BigNumber(slot.hashCode) : null,
                        key: key,
                        value: value,
                    });
                })
            )
        );
    } else {
        pySelf = pySelf.set('slots', null);
    }
    pySelf = pySelf.set('used', state.used);
    pySelf = pySelf.set('fill', state.fill);

    return pySelf;
}

function dumpPyDictState(pySelf) {
    let data = {};

    data.slots = pySelf
        .get('slots')
        .toJS()
        .map(slot => {
            return {
                hashCode: slot.hashCode != null ? slot.hashCode.toString() : null,
                key: dumpSimplePyObj(slot.key),
                value: dumpSimplePyObj(slot.value),
            };
        });
    data.used = pySelf.get('used');
    data.fill = pySelf.get('fill');

    return data;
}

const server = net.createServer(c => {
    console.log('Client connected');

    c.on('end', () => {
        console.log('Client disconnected');
    });

    c.pipe(split()).on('data', line => {
        console.log('Received line of length ' + line.length);
        if (!line) return;
        const data = JSON.parse(line);
        let pySelf = restorePyDictState(data.self);
        // console.log(self);
        const op = data.op;
        let {key, value} = data.args;
        if (key !== undefined) {
            key = parseSimplePyObj(key);
        }
        if (value !== undefined) {
            value = parseSimplePyObj(value);
        }
        console.log(op, key, value);
        let isException = false;
        let result = null;
        // TODO: the whole thing is kinda ugly, encapsulate passing all these classes (e.g. Dict32Resize around)
        // TODO: isException is really ugly, make .run() properly return exception
        switch (op) {
            case '__init__':
                pySelf = Dict32.__init__().pySelf;
                break;
            case '__getitem__': {
                ({result, isException} = Dict32.__getitem__(pySelf, key));
                break;
            }
            case '__setitem__': {
                ({pySelf} = Dict32.__setitem__(pySelf, key, value));
                break;
            }
            case '__delitem__': {
                ({pySelf, isException} = Dict32.__delitem__(pySelf, key));
                break;
            }
            default:
                throw new Error('Unknown op');
        }

        console.log('Writing response');
        c.write(
            JSON.stringify({
                exception: isException,
                result: dumpSimplePyObj(result),
                self: dumpPyDictState(pySelf),
            }) + '\n'
        );
    });
});

server.on('error', err => {
    throw err;
});

server.on('listening', () => {
    console.log(`Listening`);
});

server.listen('pynode.sock', () => {
    console.log('Starting listening...');
});
