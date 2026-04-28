# Use the official Nginx image as a parent image
FROM nginx:alpine

# Copy the frontend files to the default Nginx public folder
COPY . /usr/share/nginx/html

# Expose port 80 to the outside world
EXPOSE 80

# Start Nginx when the container launches
CMD ["nginx", "-g", "daemon off;"]
