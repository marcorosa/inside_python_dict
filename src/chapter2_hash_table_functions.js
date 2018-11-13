import * as React from 'react';
import _ from 'lodash';

import {BigNumber} from 'bignumber.js';

import {List} from 'immutable';
import {pyHash, pyHashUnicode, pyHashLong, HashBreakpointFunction, DUMMY, EQ, displayStr} from './hash_impl_common';
import {HashBoxesComponent, LineOfBoxesComponent, TetrisFactory, SimpleCodeBlock, VisualizedCode} from './code_blocks';
import {PyStringInput, PyNumberInput, PyListInput, PyStringOrNumberInput, BlockInputToolbar} from './inputs';
import {
    ChapterComponent,
    Subcontainerize,
    COLOR_FOR_READ_OPS,
    randomMeaningfulString,
    randomString3len,
    randint,
    randomChoice,
} from './util';
import {chapter1_2_FormatCheckCollision, commonFormatCheckNotFound} from './common_formatters';

import memoizeOne from 'memoize-one';

export const HASH_CREATE_NEW_CODE = [
    ['def create_new(from_keys):', 'start-execution', 0],
    ['    hash_codes = [EMPTY] * (2 * len(from_keys))', 'create-new-empty-hashes', 1],
    ['    keys = [EMPTY] * (2 * len(from_keys))', 'create-new-empty-keys', 1],
    ['', '', -1],
    ['    for key in from_keys:', 'for-loop', 2],
    ['        hash_code = hash(key)', 'compute-hash', 2],
    ['        idx = hash_code % len(keys)', 'compute-idx', 2],
    ['        while hash_codes[idx] is not EMPTY:', 'check-collision', 3],
    ['            if hash_codes[idx] == hash_code and \\', 'check-dup-hash', 3],
    ['               keys[idx] == key:', 'check-dup-key', 3],
    ['                break', 'check-dup-break', 4],
    ['            idx = (idx + 1) % len(keys)', 'next-idx', 3],
    ['', '', -1],
    ['        hash_codes[idx], keys[idx] = hash_code, key', 'assign-elem', 2],
    ['', '', -1],
    ['    return hash_codes, keys', 'return-lists', 1],
];

function anotherValue(array, ARRAY_CHANCE = 0.5, MEANINGFUL_CHANCE = 0.25, NUMBER_CHANCE = 0.2) {
    const roll = Math.random();

    if (roll < ARRAY_CHANCE) {
        return randomChoice(array);
    } else if (roll < ARRAY_CHANCE + MEANINGFUL_CHANCE) {
        return randomMeaningfulString();
    } else if (roll < ARRAY_CHANCE + MEANINGFUL_CHANCE + NUMBER_CHANCE) {
        return BigNumber(randint(-100, 100));
    } else {
        return randomString3len();
    }
}

class HashCreateNew extends HashBreakpointFunction {
    run(_fromKeys) {
        this.fromKeys = new List(_fromKeys);

        this.hashCodes = new List();
        this.keys = new List();

        for (let i = 0; i < this.fromKeys.size * 2; ++i) {
            this.hashCodes = this.hashCodes.push(null);
        }
        this.addBP('create-new-empty-hashes');

        for (let i = 0; i < this.fromKeys.size * 2; ++i) {
            this.keys = this.keys.push(null);
        }
        this.addBP('create-new-empty-keys');

        for ([this.fromKeysIdx, this.key] of this.fromKeys.entries()) {
            this.addBP('for-loop');

            this.hashCode = pyHash(this.key);
            this.addBP('compute-hash');

            this.idx = this.computeIdx(this.hashCode, this.keys.size);
            this.addBP('compute-idx');

            this.fmtCollisionCount = 0;
            while (true) {
                this.addBP('check-collision');
                if (this.keys.get(this.idx) === null) {
                    break;
                }

                this.addBP('check-dup-hash');
                if (this.hashCodes.get(this.idx).eq(this.hashCode)) {
                    this.addBP('check-dup-key');
                    if (EQ(this.keys.get(this.idx), this.key)) {
                        this.addBP('check-dup-break');
                        break;
                    }
                }

                this.fmtCollisionCount += 1;
                this.idx = (this.idx + 1) % this.keys.size;
                this.addBP('next-idx');
            }

            this.hashCodes = this.hashCodes.set(this.idx, this.hashCode);
            this.keys = this.keys.set(this.idx, this.key);
            this.addBP('assign-elem');
        }

        this.fromKeysIdx = null;
        this.key = null;

        this.addBP('return-lists');
        return [this.hashCodes, this.keys];
    }
}

const HashCreateNewStateVisualization = TetrisFactory([
    [
        LineOfBoxesComponent,
        [
            {labels: ['from_keys'], marginBottom: 20},
            'fromKeys',
            'fromKeysIdx',
            undefined,
            {selection1color: COLOR_FOR_READ_OPS},
        ],
    ],
    [HashBoxesComponent, [{labels: ['hash_codes'], marginBottom: 7}, 'hashCodes', 'idx']],
    [HashBoxesComponent, [{labels: ['keys']}, 'keys', 'idx']],
]);

function formatHashCreateNewAndInsert(bp) {
    switch (bp.point) {
        case 'create-new-empty-hashes':
            return `Create a new list of size <code>${bp.hashCodes.size}</code> for hash codes`;
        case 'create-new-empty-keys':
            return `Create a new list of size <code>${bp.keys.size}</code> for keys`;
        case 'for-loop':
            return `[${bp.fromKeysIdx + 1}/${bp.fromKeys.size}] The key to insert is <code>${displayStr(
                bp.key
            )}</code>`;
        case 'compute-hash':
            return `Compute the hash code: <code>${bp.hashCode}</code>`;
        case 'compute-idx':
            return `Compute the starting slot index: <code>${bp.idx}</code> == <code>${bp.hashCode} % ${
                bp.keys.size
            }</code>`;
        case 'check-collision':
            return chapter1_2_FormatCheckCollision(bp.keys, bp.idx, bp.fmtCollisionCount);
        case 'check-dup-hash':
            if (EQ(bp.hashCodes.get(bp.idx), bp.hashCode)) {
                return `<code>${bp.hashCodes.get(bp.idx)} == ${
                    bp.hashCode
                }</code>, we cannot rule out the slot being occupied by the same key`;
            } else {
                return `<code>${bp.hashCodes.get(bp.idx)} != ${
                    bp.hashCode
                }</code>, so there is a collision with a different key`;
            }
        case 'check-dup-key':
            if (EQ(bp.keys[bp.idx], bp.key)) {
                return `<code>${displayStr(bp.keys.get(bp.idx))} == ${displayStr(
                    bp.key
                )}</code>, so the key is already in the table`;
            } else {
                return `<code>${displayStr(bp.keys.get(bp.idx))} != ${displayStr(
                    bp.key
                )}</code>, so there is a collision`;
            }
        case 'check-dup-break':
            return 'Because the key is found, stop';
        case 'check-dup-return':
            return 'Because the key is found, stop';
        case 'next-idx':
            return `Keep probing, the next slot will be <code>${bp.idx}</code> == <code>(${bp._prevBp.idx} + 1) % ${
                bp.keys.size
            }</code>`;
        case 'assign-elem':
            if (bp._prevBp.keys.get(bp.idx) === null) {
                return `Put <code>${displayStr(bp.key)}</code> and its hash <code>${
                    bp.hashCode
                }</code> in the empty slot <code>${bp.idx}</code>`;
            } else {
                return `<code>${displayStr(bp.key)}</code> and its hash <code>${
                    bp.hashCode
                }</code> is already in the slot, overwriting it anyway`;
            }
        case 'return-lists':
            return `The hash table is complete, return the lists`;
    }
}

export const HASH_SEARCH_CODE = [
    ['def has_key(hash_codes, keys, key):', 'start-execution', 0],
    ['    hash_code = hash(key)', 'compute-hash', 1],
    ['    idx = hash_code % len(keys)', 'compute-idx', 1],
    ['    while hash_codes[idx] is not EMPTY:', 'check-not-found', 2],
    ['        if hash_codes[idx] == hash_code and \\', 'check-hash', 2],
    ['           keys[idx] == key:', 'check-key', 2],
    ['            return True', 'return-true', 3],
    ['        idx = (idx + 1) % len(keys)', 'next-idx', 2],
    ['    return False', 'return-false', 1],
];

function formatHashRemoveSearch(bp) {
    switch (bp.point) {
        case 'compute-hash':
            return `Compute the hash code: <code>${bp.hashCode}</code>`;
        case 'compute-idx':
            return `Compute the starting slot index: <code>${bp.hashCode} % ${bp.keys.size}</code> == <code>${
                bp.idx
            }</code>`;
        case 'check-not-found':
            return commonFormatCheckNotFound(bp.keys, bp.idx, bp.fmtCollisionCount);
        case 'check-hash':
            if (bp.hashCodes.get(bp.idx).eq(bp.hashCode)) {
                return `<code>${bp.hashCodes.get(bp.idx)} == ${
                    bp.hashCode
                }</code>, so the slot might contain the same key`;
            } else {
                return `<code>${bp.hashCodes.get(bp.idx)} != ${
                    bp.hashCode
                }</code>, so the slot definitely contains a different key`;
            }
        case 'check-key':
            if (EQ(bp.keys.get(bp.idx), bp.key)) {
                return `<code>${displayStr(bp.keys.get(bp.idx))} == ${displayStr(bp.key)}</code>, so the key is found`;
            } else {
                return `<code>${displayStr(bp.keys.get(bp.idx))} != ${
                    bp.key
                }</code>, so there is a different key with the same hash`;
            }
        case 'assign-dummy':
            return `Replace key in slot <code>${bp.idx}</code> with <code>DUMMY</code> placeholder`;
        case 'return':
            return `The key is removed, now return`;
        case 'next-idx':
            return `Keep retracing probing steps, the next slot will be <code>${bp.idx}</code> == <code>(${
                bp._prevBp.idx
            } + 1) % ${bp.keys.size}</code>`;
        case 'throw-key-error':
            return `Throw an exception, because no key was found`;
        /* search */
        case 'return-true':
            return `So return <code>True</code>`;
        case 'return-false':
            return `So return <code>False</code>`;
    }
}

const HashNormalStateVisualization = TetrisFactory([
    [HashBoxesComponent, [{labels: ['hash_codes'], marginBottom: 7}, 'hashCodes', 'idx']],
    [HashBoxesComponent, [{labels: ['keys']}, 'keys', 'idx']],
]);

export const HASH_REMOVE_CODE = [
    ['def remove(hash_codes, keys, key):', 'start-execution', 0],
    ['    hash_code = hash(key)', 'compute-hash', 1],
    ['    idx = hash_code % len(keys)', 'compute-idx', 1],
    ['', '', -1],
    ['    while hash_codes[idx] is not EMPTY:', 'check-not-found', 2],
    ['        if hash_codes[idx] == hash_code and \\', 'check-hash', 2],
    ['           keys[idx] == key:', 'check-key', 2],
    ['            keys[idx] = DUMMY', 'assign-dummy', 2],
    ['            return', 'return', 3],
    ['        idx = (idx + 1) % len(keys)', 'next-idx', 2],
    ['', ''],
    ['    raise KeyError()', 'throw-key-error', 1],
];

class HashRemoveOrSearch extends HashBreakpointFunction {
    run(_hashCodes, _keys, _key, isRemoveMode) {
        this.hashCodes = new List(_hashCodes);
        this.keys = new List(_keys);
        this.key = _key;

        this.fmtCollisionCount = 0;

        this.hashCode = pyHash(this.key);
        this.addBP('compute-hash');

        this.idx = this.computeIdx(this.hashCode, this.keys.size);
        this.addBP('compute-idx');

        while (true) {
            this.addBP('check-not-found');
            if (this.keys.get(this.idx) === null) {
                break;
            }

            this.addBP('check-hash');
            if (this.hashCodes.get(this.idx).eq(this.hashCode)) {
                this.addBP('check-key');
                if (EQ(this.keys.get(this.idx), this.key)) {
                    if (isRemoveMode) {
                        this.keys = this.keys.set(this.idx, DUMMY);
                        this.addBP('assign-dummy');
                        this.addBP('return');
                        return {hashCodes: this.hashCodes, keys: this.keys, isException: false, result: null};
                    } else {
                        this.addBP('return-true');
                        return {hashCodes: this.hashCodes, keys: this.keys, isException: false, result: true};
                    }
                }
            }

            this.fmtCollisionCount += 1;

            this.idx = (this.idx + 1) % this.keys.size;
            this.addBP('next-idx');
        }

        let result, isException;
        if (isRemoveMode) {
            this.addBP('throw-key-error');
            isException = true;
        } else {
            this.addBP('return-false');
            isException = false;
            result = false;
        }

        return {hashCodes: this.hashCodes, keys: this.keys, isException, result};
    }
}

export const HASH_RESIZE_CODE = [
    ['def resize(hash_codes, keys):', 'start-execution', 0],
    ['    new_hash_codes = [EMPTY] * (2 * len(hash_codes))', 'create-new-empty-hashes', 1],
    ['    new_keys = [EMPTY] * (2 * len(keys))', 'create-new-empty-keys', 1],
    ['    for hash_code, key in zip(hash_codes, keys):', 'for-loop', 2],
    ['        if key is EMPTY or key is DUMMY:', 'check-skip-empty-dummy', 2],
    ['            continue', 'continue', 3],
    ['        idx = hash_code % len(new_keys)', 'compute-idx', 2],
    ['        while new_hash_codes[idx] is not EMPTY:', 'check-collision', 3],
    ['            idx = (idx + 1) % len(new_keys)', 'next-idx', 3],
    ['        new_hash_codes[idx], new_keys[idx] = hash_code, key', 'assign-elem', 2],
    ['', ''],
    ['    return new_hash_codes, new_keys', 'return-lists', 1],
];

class HashResize extends HashBreakpointFunction {
    run(_hashCodes, _keys) {
        this.hashCodes = _hashCodes;
        this.keys = _keys;

        this.newHashCodes = new List();
        this.newKeys = new List();

        for (let i = 0; i < this.hashCodes.size * 2; ++i) {
            this.newHashCodes = this.newHashCodes.push(null);
        }
        this.addBP('create-new-empty-hashes');

        for (let i = 0; i < this.hashCodes.size * 2; ++i) {
            this.newKeys = this.newKeys.push(null);
        }
        this.addBP('create-new-empty-keys');

        for ([this.oldIdx, [this.hashCode, this.key]] of this.hashCodes.zip(this.keys).entries()) {
            this.addBP('for-loop');
            this.addBP('check-skip-empty-dummy');
            if (this.key === null || this.key === DUMMY) {
                this.addBP('continue');
                continue;
            }

            this.fmtCollisionCount = 0;
            this.idx = this.computeIdx(this.hashCode, this.newKeys.size);
            this.addBP('compute-idx');

            while (true) {
                this.addBP('check-collision');
                if (this.newKeys.get(this.idx) === null) {
                    break;
                }

                this.fmtCollisionCount += 1;
                this.idx = (this.idx + 1) % this.newKeys.size;
                this.addBP('next-idx');
            }

            this.newHashCodes = this.newHashCodes.set(this.idx, this.hashCode);
            this.newKeys = this.newKeys.set(this.idx, this.key);
            this.addBP('assign-elem');
        }
        this.addBP('return-lists');
        return [this.newHashCodes, this.newKeys];
    }
}

function formatHashResize(bp) {
    switch (bp.point) {
        case 'create-new-empty-hashes':
            return `Create a new list of size <code>${bp.newHashCodes.size}</code> for hash codes`;
        case 'create-new-empty-keys':
            return `Create a new list of size <code>${bp.newKeys.size}</code> for keys`;
        case 'for-loop':
            return `[${bp.oldIdx + 1}/${bp.keys.size}] The current key to insert is <code>${
                bp.key === null ? 'EMPTY' : bp.key
            }</code>, its hash is <code>${bp.hashCode === null ? 'EMPTY' : bp.hashCode}</code>`;
        case 'compute-idx':
            return `Compute the starting slot index: <code>${bp.idx} == ${bp.hashCode} % ${bp.newKeys.size}</code>`;
        case 'check-skip-empty-dummy':
            if (bp.keys.get(bp.oldIdx) === null) {
                return `The current slot is empty`;
            } else if (bp.keys.get(bp.oldIdx) === DUMMY) {
                return `The current slot contains DUMMY placeholder`;
            } else {
                return `The current slot is occupied by a non-removed key`;
            }
        case 'continue':
            return 'So skip it';
        case 'check-collision':
            return chapter1_2_FormatCheckCollision(bp.newKeys, bp.idx, bp.fmtCollisionCount);
        case 'next-idx':
            return `Keep probing, the next slot will be <code>${bp.idx}</code> == <code>(${bp._prevBp.idx} + 1) % ${
                bp.keys.size
            }</code>`;
        case 'assign-elem':
            return `Put <code>${displayStr(bp.key)}</code> and its hash <code>${bp.hashCode}</code> in the empty slot ${
                bp.idx
            }`;
        case 'return-lists':
            return `The hash table has been rebuilt, return the lists`;
    }
}

const HashResizeStateVisualization = TetrisFactory([
    [
        HashBoxesComponent,
        [
            {labels: ['hash_codes'], marginBottom: 7},
            'hashCodes',
            'oldIdx',
            undefined,
            {selection1color: COLOR_FOR_READ_OPS},
        ],
    ],
    [
        HashBoxesComponent,
        [{labels: ['keys'], marginBottom: 20}, 'keys', 'oldIdx', undefined, {selection1color: COLOR_FOR_READ_OPS}],
    ],
    [HashBoxesComponent, [{labels: ['new_hash_codes'], marginBottom: 7}, 'newHashCodes', 'idx']],
    [HashBoxesComponent, [{labels: ['new_keys']}, 'newKeys', 'idx']],
]);

export const HASH_INSERT_CODE = [
    ['def insert(hash_codes, keys, key):', 'start-execution'],
    ['    hash_code = hash(key)', 'compute-hash'],
    ['    idx = hash_code % len(keys)', 'compute-idx'],
    ['', ''],
    ['    while keys[idx] is not EMPTY:', 'check-collision'],
    ['        if hash_codes[idx] == hash_code and\\', 'check-dup-hash'],
    ['           keys[idx] == key:', 'check-dup-key'],
    ['            break', 'check-dup-break'],
    ['        idx = (idx + 1) % len(keys)', 'next-idx'],
    ['', ''],
    ['    hash_codes[idx], keys[idx] = hash_code, key', 'assign-elem'],
];

class HashInsert extends HashBreakpointFunction {
    run(_hashCodes, _keys, _key) {
        this.hashCodes = new List(_hashCodes);
        this.keys = new List(_keys);
        this.key = _key;

        this.hashCode = pyHash(this.key);
        this.addBP('compute-hash');

        this.idx = this.computeIdx(this.hashCode, this.keys.size);
        this.addBP('compute-idx');

        while (true) {
            this.addBP('check-collision');
            if (this.keys.get(this.idx) === null) {
                break;
            }

            this.addBP('check-dup-hash');
            if (this.hashCodes.get(this.idx).eq(this.hashCode)) {
                this.addBP('check-dup-key');
                if (EQ(this.keys.get(this.idx), this.key)) {
                    this.addBP('check-dup-break');
                    break;
                }
            }

            this.idx = (this.idx + 1) % this.keys.size;
            this.addBP('next-idx');
        }
        this.hashCodes = this.hashCodes.set(this.idx, this.hashCode);
        this.keys = this.keys.set(this.idx, this.key);

        this.addBP('assign-elem');
        return [this.hashCodes, this.keys];
    }
}

class HashExamples extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            string: 'Hello',
            integer: 42,
        };
    }

    render() {
        return (
            <div>
                <span>Strings: </span>
                <code>hash(</code>
                <PyStringInput
                    autogrowing={true}
                    value={this.state.string}
                    onChange={value => this.setState({string: value})}
                />
                <code>)</code> = <code>{pyHashUnicode(this.state.string)}</code>
                <br />
                <br />
                <span>Integers: </span>
                <code>hash(</code>
                <PyNumberInput
                    autogrowing={true}
                    value={this.state.integer}
                    onChange={value => this.setState({integer: value})}
                />
                <code>)</code> = <code>{pyHashLong(BigNumber(this.state.integer)).toFixed()}</code>
                <br />
                <br />
                <span>Floats: </span>
                <code>hash(42.5)</code> = <code>1426259968</code>
                <br />
                <br />
                <span>Tuples: </span>
                <code>hash(("Hello", 42))</code> = <code>4421265786515608844</code>
                <br />
                <br />
                <span>None: </span>
                <code>hash(None)</code> = <code>-9223372036581563745</code>
                <br />
                <br />
            </div>
        );
    }
}

export class Ops {
    static createNew(array) {
        const hcn = new HashCreateNew();
        const [hashCodes, keys] = hcn.run(array);
        const bp = hcn.getBreakpoints();
        return {hashCodes, keys, bp};
    }

    static hasKey(hashCodes, keys, searchedObj) {
        const hs = new HashRemoveOrSearch();
        const {result, hashCodes: newHashCodes, keys: newKeys} = hs.run(hashCodes, keys, searchedObj, false);
        const bp = hs.getBreakpoints();

        return {result, bp, hashCodes: newHashCodes, keys: newKeys};
    }

    static remove(hashCodes, keys, objToRemove) {
        const hr = new HashRemoveOrSearch();
        const {isException, hashCodes: newHashCodes, keys: newKeys} = hr.run(hashCodes, keys, objToRemove, true);
        const bp = hr.getBreakpoints();

        return {isException, bp, hashCodes: newHashCodes, keys: newKeys};
    }

    static resize(hashCodes, keys) {
        const hres = new HashResize();
        const [newHashCodes, newKeys] = hres.run(hashCodes, keys);
        const bp = hres.getBreakpoints();

        return {bp, hashCodes: newHashCodes, keys: newKeys};
    }

    static insert(hashCodes, keys, objToInsert) {
        const hi = new HashInsert();
        const [newHashCodes, newKeys] = hi.run(hashCodes, keys, objToInsert);
        const bp = hi.getBreakpoints();

        return {bp, hashCodes: newHashCodes, keys: newKeys};
    }
}

function ListDescription({array}) {
    let countStr = array.filter(e => typeof e === 'string').length;
    let countNum = array.length - countStr;
    if (countStr > 0 && countNum > 0) {
        return 'a mixed list of integers and strings';
    } else if (countStr > 0) {
        return 'a list of strings';
    } else {
        return 'a list of integers';
    }
}

export class Chapter2_HashTableFunctions extends ChapterComponent {
    constructor() {
        super();

        this.state = {
            array: ['ping', 42, 'dmesg', -3, 'find', 'rm', 'test', 'mv', 'mkdir', 'vim'],
            objToRemove: 'rm',
            objToInsert: 'grep',
            searchedObj: 'vim',
        };
    }

    runCreateNew = memoizeOne(array => {
        return Ops.createNew(array);
    });

    runSearch = memoizeOne((hashCodes, keys, searchedObj) => {
        const bp = Ops.hasKey(hashCodes, keys, searchedObj).bp;
        return {bp};
    });

    runRemove = memoizeOne((hashCodes, keys, objToRemove) => {
        const bp = Ops.remove(hashCodes, keys, objToRemove).bp;
        return {bp};
    });

    runResize = memoizeOne((hashCodes, keys) => {
        const bp = Ops.resize(hashCodes, keys).bp;
        return {bp};
    });

    runInsert = memoizeOne((hashCodes, keys, objToInsert) => {
        const bp = Ops.insert(hashCodes, keys, objToInsert).bp;
        return {bp};
    });

    render() {
        const t1 = performance.now();
        const newRes = this.runCreateNew(this.state.array);
        let {hashCodes, keys} = newRes;

        // TODO: make results of operations connected to each other ?
        const searchRes = this.runSearch(hashCodes, keys, this.state.searchedObj);
        const removeRes = this.runRemove(hashCodes, keys, this.state.objToRemove);
        const resizeRes = this.runResize(hashCodes, keys);
        const insertRes = this.runInsert(hashCodes, keys, this.state.objToInsert);
        console.log('Chapter2 render timing', performance.now() - t1);

        return (
            <div className="chapter chapter2">
                <h2> Chapter 2. Why are hash tables called hash tables? </h2>
                <Subcontainerize>
                    <p>
                        Now that we have the solution for searching in a list of numbers, can we use this for
                        non-integer objects? We can if we find a way to turn objects into numbers for indexing. We don't
                        need a perfect one-to-one correspondence between objects and integers. In fact, it is totally
                        fine if two unrelated objects are turned into the same number &mdash; we can use linear probing
                        to resolve this collision anyway! However, if we turn all objects into the same number, for
                        example, <code>42</code>, our hash table would work, but its performance would severely degrade.
                        So, for performance reasons it is desirable to get distinct numbers for distinct objects
                        usually. The transformation also needs to be completely predictable and deterministic, i.e. we
                        need to always get the same value for the same object. In other words, something like{' '}
                        <code>random()</code> would not work, because we would "forget" where we placed our objects and
                        we wouldn't be able to locate them during a search.
                    </p>
                    <p>
                        Functions that do this kind of transformation are called <em>hash functions</em>. Since it is
                        not required to preserve any order in the input domain, a typical hash function "mixes up" its
                        input domain, hence the name "hash".
                    </p>
                    <p>
                        In python, there are built-in implementations of hash functions for many built-in types. They
                        are all available through a single interface: python function <code>hash()</code>. This python
                        function can take any python object as an input and call an appropriate implementation (if it
                        exists).
                    </p>
                    <HashExamples />
                    <p>
                        In the case of strings, <code>hash()</code> returns fairly unpredictable results, as it should.
                        One major exception is integers; you can notice that <code>hash(x) == x</code> for small
                        numbers. This fact may seem surprising to people familiar with hash functions, however it is a
                        deliberate design decision by Python Core Developers.
                    </p>
                    <p>
                        For big("long") integers, python uses a different algorithm. Try typing a relatively big number,
                        for example, <code>12345678901234567890</code> to see this.
                    </p>
                    <h5>hash() implementation notes</h5>
                    <p>
                        This chapter and the next two chapters will use <code>hash()</code> implementation from python
                        3.2 (running on an x86_64 system). So if you run python 3.2 on your x86_64 system, you should
                        see the same hash values for integers and strings (and the same data structure states).{' '}
                        <code>hash(None)</code> changes between runs, but this page does not change{' '}
                        <code>hash(None)</code> between refreshes and assumes that{' '}
                        <code>hash(None) == -9223372036581563745</code>
                    </p>
                    <p>
                        Why python 3.2? Because dict implementation changed over time, but python 3.2's dict implements
                        all major ideas, and thus python 3.2 is a perfect starting point for exploring implementations
                        of python dict. Later versions of python extend (rather than completely replace) python 3.2's
                        implementation. Eventually, we will get to these implementations as well.
                    </p>
                    <h5> Unhashable types </h5>
                    <p>
                        Not all types are hashable. For example, for lists if you call{' '}
                        <code>hash(["some", "values"])</code> you will get{' '}
                        <code>TypeError: unhashable type: 'list'</code>. Why can't we use the same hash function as for
                        tuples? The answer is because lists are mutable and tuples are not. Mutability, per se, does not
                        prevent us from defining a hash function. However changing a list would change the value of the
                        hash function as well, and therefore we will not be able to find the mutated list! Hashing and
                        using lists as keys in dicts would lead to many accidental bugs, so developers of python chose
                        not to allow this.
                    </p>
                    <h5>A note on the word "hash"</h5>
                    <p>
                        Because hash tables use hash functions and because hash tables mix up inserted elements, they
                        are called hash tables. Sometimes people shorten "hash table" to simply "hash". The output of a
                        hash function is sometimes called "hash value" or "hash code", but very often it is shortened to
                        simple "hash". Also, python's built-in hash function is called <code>hash()</code>. Because
                        people like to shorten things, three different (but related) concepts end up having the same
                        shortened name. This can get a bit confusing sometimes.
                    </p>
                    <h5> Using hash functions for hash tables </h5>
                    <p>
                        Recall that we started with a simple problem: searching efficiently in a list of distinct
                        numbers. Now, let's make this problem harder: our hash table needs to support types other than
                        integers, handle duplicates and support removing and adding keys (and therefore resizing). We
                        will see how to handle values in the next chapter, but for now let's assume we only need to
                        search for keys.
                    </p>
                    <p>How does using hash functions change the insertion algorithm?</p>
                    <p>
                        Obviously, we have to use <code>hash()</code> function to convert objects into integers for
                        indexing.
                    </p>
                    <p>
                        Because <code>None</code> is hashable too, we will need to use some other value as a placeholder
                        for an empty slot. The cleanest way to do this is to create a new type and use a value of this
                        type. In python, this is quite simple:
                    </p>
                    <SimpleCodeBlock>{`
class EmptyValueClass(object):
    pass

EMPTY = EmptyValueClass()
              `}</SimpleCodeBlock>
                    <p>
                        We will now use <code>EMPTY</code> to denote an empty slot. After we do this, we will be able to
                        insert <code>None</code> in the hash table safely.
                    </p>
                    <p>
                        But here is one critical and subtle thing: checking for equality of objects can be expensive.
                        For example, comparing strings of length 10000 may require up to 10000 comparison operations -
                        one per each pair of corresponding characters. And, we may end up doing several equality checks
                        when doing linear probing.
                    </p>
                    <p>
                        When we only had integers, we didn't have this problem, because comparing integers is cheap. But
                        here is a neat trick we can use to improve the performance in the case of arbitrary objects. We
                        still get numbers from hash functions. So, we can cache these numbers and compare them before
                        comparing actual objects. When comparing hashes, there are two different outcomes. First, the
                        hashes are different; in this case, we can safely conclude that the objects are different as
                        well. Second, the hashes are equal; in this case, there is still a possibility of two distinct
                        objects having the same hash, so we have to compare the actual objects.
                    </p>
                    <p>
                        This optimization is an example of a space-time tradeoff. We spend extra memory to make the
                        algorithm faster.
                    </p>
                    <p>
                        Let's allow duplicates. Remember how search works in chapter 1? We retrace the steps necessary
                        to insert the element, and check if any slot on the way contains it. We also retrace all the
                        steps necessary to insert the element when we are actually inserting it. Let's use this fact for
                        handling duplicates - we can terminate the insertion process if we find the element. And if we
                        hit an empty slot without finding the element, then it is not in the table and we can insert it.
                    </p>
                    <p>
                        Now, let's see this algorithm in action. We'll use a separate list called{' '}
                        <code>hash_codes</code> for caching values of hash functions.
                    </p>
                    <p>
                        Let's say we have <ListDescription array={this.state.array} />:
                    </p>
                    <BlockInputToolbar
                        input={PyListInput}
                        initialValue={this.state.array}
                        onChange={this.setter('array')}
                        bottomBoundary=".chapter2"
                    />
                    <VisualizedCode
                        code={HASH_CREATE_NEW_CODE}
                        breakpoints={newRes.bp}
                        formatBpDesc={formatHashCreateNewAndInsert}
                        stateVisualization={HashCreateNewStateVisualization}
                        {...this.props}
                    />
                    <h5> Searching </h5>
                    <p>
                        The search algorithm isn't changed much. We just get the <code>hash()</code> function value for
                        the object, and just like with the inserting algorithm, during linear probing we compare actual
                        objects only when hashes are equal.
                    </p>
                    <div className="div-p">
                        For instance, let's search for
                        <PyStringOrNumberInput
                            inline={true}
                            value={this.state.searchedObj}
                            onChange={this.setter('searchedObj')}
                            anotherValue={() => anotherValue(this.state.array)}
                        />
                    </div>
                    <p className="inline-block">and see what happens:</p>
                    <VisualizedCode
                        code={HASH_SEARCH_CODE}
                        breakpoints={searchRes.bp}
                        formatBpDesc={formatHashRemoveSearch}
                        stateVisualization={HashNormalStateVisualization}
                        {...this.props}
                    />
                    <h5> Removing objects </h5>
                    <p>
                        If we removed a key without a trace, it'd leave a hole, and this would break the search
                        algorithm. Then, how do we remove a key?
                    </p>
                    <p>
                        The answer is that if we can't remove a key without a trace, we should leave a trace. When
                        removing a key, we replace it with a "dummy" object (another term for this object is
                        "tombstone"). This object acts as a placeholder that indicates we shouldn't stop probing during
                        a search.
                    </p>
                    <p>
                        We can create this placeholder object just like we created <code>EMPTY</code>:
                    </p>
                    <SimpleCodeBlock>{`
class DummyValueClass(object):
    pass

DUMMY = DummyValueClass()
              `}</SimpleCodeBlock>
                    <div className="div-p">
                        Let's see removing in action. Let's say we want to remove:
                        <PyStringOrNumberInput
                            inline={true}
                            value={this.state.objToRemove}
                            onChange={this.setter('objToRemove')}
                            anotherValue={() => anotherValue(this.state.array, 0.7, 0.2, 0.1)}
                        />
                    </div>
                    <VisualizedCode
                        code={HASH_REMOVE_CODE}
                        breakpoints={removeRes.bp}
                        formatBpDesc={formatHashRemoveSearch}
                        stateVisualization={HashNormalStateVisualization}
                        {...this.props}
                    />
                    <p>
                        Removing a lot of objects may lead to a table being filled with these dummy objects. What if a
                        table overflows with dummy objects? There is a way to clean them up. But first, let's see what
                        happens if a table overflows with ordinary objects.
                    </p>
                    <h5>Resizing hash tables</h5>
                    <p>
                        How do we resize a hash table? The index of each element depends on the table size, so it may
                        change if the size of a table changes. Moreover, because of collisions and linear probing, each
                        index may depend on the indexes of other objects (which, in turn, also depend on the size of a
                        table and the indexes of other objects). This is a tangled mess.
                    </p>
                    <p>
                        There is a way to disentangle this Gordian Knot, however. We can create a new, bigger table and
                        re-insert all the elements from the smaller table (skipping dummy placeholders). This may sound
                        expensive. And, it <em>is</em> expensive. But, the thing is, we don't have to resize the table
                        after every operation. If we make the new table size 1.5x, 2x or even 4x the size of the old
                        table, we will do the resize operation rarely enough that the heavy cost of it will amortize
                        (spread out) over many insertions/deletions.
                    </p>
                    <p>Let's see how we could resize the current table</p>
                    <VisualizedCode
                        code={HASH_RESIZE_CODE}
                        breakpoints={resizeRes.bp}
                        formatBpDesc={formatHashResize}
                        stateVisualization={HashResizeStateVisualization}
                        {...this.props}
                    />
                    <p>
                        There is still one more important question. What condition should trigger the resizing
                        operation? If we postpone resizing until a table is nearly full, the performance will severely
                        degrade. If we resize a table when it is still sparse, we will waste memory. Typically, a hash
                        table is resized when it is around 66% full.
                    </p>
                    <p>
                        The number of non-empty slots (including dummy/tombstone slots) is called <em>fill</em>. The
                        ratio between fill and table size is called the <em>load factor</em> (also, sometimes:{' '}
                        <em>fill factor</em> or <em>fill ratio</em>
                        ). So, using the new terms, we can say that a hash table is resized when the load factor reaches
                        66%. Usually, the size is increased, we may also need to shrink the table in case there are a
                        lot of dummy placeholders.
                    </p>
                    <p>
                        To implement this efficiently, we need to track the load factor. So, we will need two counters
                        for tracking fill and "real" usage. With the current code structure, tracking these counters
                        would be messy because we would need to pass these counters to and from every function. A much
                        cleaner solution would be using classes.
                    </p>
                </Subcontainerize>
            </div>
        );
    }
}
