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
RUN deno task build:all

CMD [ "sh", "-c", "deno task dev" ]
