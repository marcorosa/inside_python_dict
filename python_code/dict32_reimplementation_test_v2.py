import random
import argparse
import json

from common import EMPTY, AllKeyValueFactory, IntKeyValueFactory
from dictinfo import dump_py_dict
from dict_reimplementation import PyDictReimplementation32, dump_reimpl_dict
from js_reimplementation_interface import Dict32JsImpl, AlmostPythonDictRecyclingJsImpl, AlmostPythonDictNoRecyclingJsImpl
import hash_chapter3_class_impl
import build_autogenerated_chapter3_chapter4


def dict_factory(pairs=None):
    if not pairs:
        return {}

    # quick&dirty
    def to_string(x):
        return json.dumps(x) if x is not None else "None"
    d = eval("{" + ", ".join("{}:{}".format(to_string(k), to_string(v)) for [k, v] in pairs) + "}")
    return d


IMPLEMENTATIONS = {
    "dict_actual": (dict_factory, dump_py_dict),
    "dict32_reimpl_py": (PyDictReimplementation32, dump_reimpl_dict),
    "dict32_reimpl_js": (Dict32JsImpl, dump_reimpl_dict),

    "dict32_reimpl_py_extracted": (build_autogenerated_chapter3_chapter4.Dict32Extracted, dump_reimpl_dict),

    "almost_python_dict_recycling_py": (hash_chapter3_class_impl.AlmostPythonDictImplementationRecycling, dump_reimpl_dict),
    "almost_python_dict_no_recycling_py": (hash_chapter3_class_impl.AlmostPythonDictImplementationNoRecycling, dump_reimpl_dict),
    "almost_python_dict_no_recycling_py_simpler": (hash_chapter3_class_impl.AlmostPythonDictImplementationNoRecyclingSimplerVersion, dump_reimpl_dict),
    "almost_python_dict_recycling_js": (AlmostPythonDictRecyclingJsImpl, dump_reimpl_dict),
    "almost_python_dict_no_recycling_js": (AlmostPythonDictNoRecyclingJsImpl, dump_reimpl_dict),

    "almost_python_dict_recycling_py_extracted": (build_autogenerated_chapter3_chapter4.HashClassRecyclingExtracted, dump_reimpl_dict),
    "almost_python_dict_no_recycling_py_extracted": (build_autogenerated_chapter3_chapter4.HashClassNoRecyclingExtracted, dump_reimpl_dict),
}


def verify_same(d, dump_d_func, dreimpl, dump_dreimpl_func):
    dump_d = dump_d_func(d)
    dump_reimpl = dump_dreimpl_func(dreimpl)

    if dump_d != dump_reimpl:
        hashes_orig, keys_orig, values_orig, fill_orig, used_orig = dump_d
        hashes_new, keys_new, values_new, fill_new, used_new = dump_reimpl
        print("ORIG SIZE", len(hashes_orig))
        print("NEW SIZE", len(hashes_new))
        print("ORIG fill/used: ", fill_orig, used_orig)
        print("NEW fill/used: ", fill_new, used_new)
        if len(hashes_orig) == len(hashes_new):
            size = len(hashes_orig)
            print("NEW | ORIG")
            for i in range(size):
                if hashes_new[i] is not EMPTY or hashes_orig[i] is not EMPTY:
                    print(i, " " * 3,
                          hashes_new[i], keys_new[i], values_new[i], " " * 3,
                          hashes_orig[i], keys_orig[i], values_orig[i])

    assert dump_d == dump_reimpl


def run(ref_impl_factory, ref_impl_dump, test_impl_factory, test_impl_dump, n_inserts, extra_checks, key_value_factory, initial_state, verbose):
    SINGLE_REMOVE_CHANCE = 0.3
    MASS_REMOVE_CHANCE = 0.002
    MASS_REMOVE_COEFF = 0.8

    removed = set()

    if initial_state:
        d = ref_impl_factory(initial_state)
    else:
        d = ref_impl_factory()

    if initial_state:
        dreimpl = test_impl_factory(initial_state)
    else:
        dreimpl = test_impl_factory()

    if verbose:
        print("Starting test")

    for i in range(n_inserts):
        should_remove = (random.random() < SINGLE_REMOVE_CHANCE)
        if should_remove and d and d.keys():  # TODO: ugly, written while on a plane
            to_remove = random.choice(list(d.keys()))
            if verbose:
                print("Removing {}".format(to_remove))
            del d[to_remove]
            del dreimpl[to_remove]
            if verbose:
                print(d)
            verify_same(d, ref_impl_dump, dreimpl, test_impl_dump)
            removed.add(to_remove)

        should_mass_remove = (random.random() < MASS_REMOVE_CHANCE)
        if should_mass_remove and len(d) > 10:
            to_remove_list = random.sample(list(d.keys()), int(MASS_REMOVE_COEFF * len(d)))
            if verbose:
                print("Mass-Removing {} elements".format(len(to_remove_list)))
            for k in to_remove_list:
                del d[k]
                del dreimpl[k]
                removed.add(k)

        if extra_checks:
            for k in d.keys():
                assert d[k] == dreimpl[k]

            for r in removed:
                try:
                    dreimpl[r]
                    assert False
                except KeyError:
                    pass

        key_to_insert = key_value_factory.generate_key()
        value_to_insert = key_value_factory.generate_value()
        _keys_set = getattr(d, '_keys_set', None)
        # TODO: ugly code written on a plane
        # TODO: properly implement in/not in when I land
        if _keys_set is not None:
            key_present = key_to_insert in _keys_set
        else:
            key_present = key_to_insert in d

        if not key_present:
            if verbose:
                print("Inserting ({key}, {value})".format(key=key_to_insert, value=value_to_insert))
            try:
                dreimpl[key_to_insert]
                assert False
            except KeyError:
                pass
        else:
            if verbose:
                print("Replacing ({key}, {value1}) with ({key}, {value2})".format(key=key_to_insert, value1=d[key_to_insert], value2=value_to_insert))
        removed.discard(key_to_insert)
        d[key_to_insert] = value_to_insert
        dreimpl[key_to_insert] = value_to_insert
        if verbose:
            print(d)
        verify_same(d, ref_impl_dump, dreimpl, test_impl_dump)
        assert dreimpl[key_to_insert] == value_to_insert


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Stress-test dict-like reimplementations')
    parser.add_argument('--reference-implementation', choices=IMPLEMENTATIONS.keys(), required=True)
    parser.add_argument('--test-implementation', choices=IMPLEMENTATIONS.keys(), required=True)
    parser.add_argument('--no-extra-getitem-checks', dest='extra_checks', action='store_false')
    parser.add_argument('--num-inserts',  type=int, default=500)
    parser.add_argument('--forever', action='store_true')
    parser.add_argument('--kv', choices=["numbers", "all"], required=True)
    parser.add_argument('--initial-size', type=int, default=-1)
    parser.add_argument('--verbose', action='store_true')
    args = parser.parse_args()

    if args.kv == "numbers":
        kv_factory = IntKeyValueFactory(args.num_inserts)
    elif args.kv == "all":
        kv_factory = AllKeyValueFactory(args.num_inserts)

    ref_impl = IMPLEMENTATIONS[args.reference_implementation]
    test_impl = IMPLEMENTATIONS[args.test_implementation]

    def test_iteration():
        initial_size = args.initial_size if args.initial_size >= 0 else random.randint(0, 100)
        initial_state = [(kv_factory.generate_key(), kv_factory.generate_value()) for _ in range(initial_size)]
        run(*(ref_impl + test_impl),
            n_inserts=args.num_inserts,
            extra_checks=args.extra_checks,
            key_value_factory=kv_factory,
            initial_state=initial_state,
            verbose=args.verbose)

    if args.forever:
        while True:
            test_iteration()
    else:
        test_iteration()
