FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_HOST=localhost
ARG VITE_API_PORT=3000
ARG VITE_API_PROTOCOL=http
ARG VITE_WS_PROTOCOL=ws
ENV VITE_API_HOST=$VITE_API_HOST
ENV VITE_API_PORT=$VITE_API_PORT
ENV VITE_API_PROTOCOL=$VITE_API_PROTOCOL
ENV VITE_WS_PROTOCOL=$VITE_WS_PROTOCOL

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]