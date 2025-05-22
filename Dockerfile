FROM rust:1-slim-bookworm

EXPOSE 8000
VOLUME /data
WORKDIR /usr/src/app

RUN apt-get update
RUN apt-get install -yq bash git-lfs openssh-client curl unzip
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

COPY . ./

WORKDIR "/usr/src/app"

RUN deno install
# deno task --recursive build # TODO make somehow vite dependent on wasm
RUN deno task -f @kerebron/odt-wasm build
RUN deno task -f example-vue build

CMD [ "sh", "-c", "deno task -f example-server-hono start" ]
