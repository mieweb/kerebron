FROM node:22-bookworm-slim

EXPOSE 8000
VOLUME /data
WORKDIR /usr/src/app

RUN apt-get update
RUN apt-get install -yq bash git-lfs openssh-client curl unzip
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

COPY . ./

WORKDIR "/usr/src/app"

RUN deno install
RUN deno task -f example-vue build

CMD [ "sh", "-c", "deno task -f example-server-hono start" ]
