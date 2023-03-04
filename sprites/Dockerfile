FROM ubuntu:13.10
RUN curl -sL https://deb.nodesource.com/setup_5.x | bash - 
RUN sed -i -re 's/([a-z]{2}\.)?archive.ubuntu.com|security.ubuntu.com/old-releases.ubuntu.com/g' /etc/apt/sources.list
RUN apt-get update && apt-get install -y nodejs npm git
RUN npm config set strict-ssl false && npm config set registry="http://registry.npmjs.org/"
COPY package.json .
RUN npm install --verbose
RUN mkdir -p /app
WORKDIR /app
COPY sdf-render.js .
COPY src src
CMD ["node", "sdf-render.js"]
