# Dockerfile for serving test.html as a static site
FROM nginx:alpine

# Copy test.html to nginx html directory
COPY test.html /usr/share/nginx/html/index.html

# Create simple nginx config inline (no separate file needed)
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { try_files $uri $uri/ /index.html; } \
    add_header X-Frame-Options "SAMEORIGIN" always; \
    add_header X-Content-Type-Options "nosniff" always; \
}' > /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
