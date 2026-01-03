# Ultra-simple Dockerfile for serving test.html
FROM nginx:alpine

# Copy test.html as index.html
COPY test.html /usr/share/nginx/html/index.html

# nginx:alpine already has a working default config
# Just expose port 80 (nginx listens on 80 by default)
EXPOSE 80
