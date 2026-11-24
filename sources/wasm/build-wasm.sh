#!/bin/sh
# Rebuild finder.wasm. Only needed after changing wrap.c or the cubiomes patch.
# Needs git and wasi-sdk 25 (https://github.com/WebAssembly/wasi-sdk/releases).
#   WASI_SDK=/path/to/wasi-sdk-25.0-x86_64-linux sh build-wasm.sh
set -e
cd "$(dirname "$0")"
W=${WASI_SDK:-wasi-sdk-25.0-x86_64-linux}
if [ ! -d cubiomes ]; then
  # cubiomes as of November 2024 (its last update), plus the Base Scout changes for 1.21.5 to 26.3
  git clone -q https://github.com/Cubitect/cubiomes.git cubiomes
  (cd cubiomes && git checkout -q e61f90580cbdd883214a8054670dacae655e59c0 && git apply ../cubiomes-basescout.patch)
fi
"$W/bin/clang" --sysroot="$W/share/wasi-sysroot" --target=wasm32-wasi -O3 -D_WASI_EMULATED_PTHREAD \
  -mexec-model=reactor -Wl,--strip-all -Wl,-z,stack-size=1048576 -Wl,--initial-memory=67108864 \
  -Wl,--max-memory=1073741824 -Wno-everything wrap.c \
  cubiomes/generator.c cubiomes/finders.c cubiomes/util.c cubiomes/biomenoise.c cubiomes/biomes.c \
  cubiomes/layers.c cubiomes/noise.c cubiomes/quadbase.c \
  -lwasi-emulated-pthread -o finder.wasm 2>&1 | grep -v 'pthread_exit\|>>> defined' || true
echo "finder.wasm: $(wc -c < finder.wasm) bytes"
