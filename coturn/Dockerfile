FROM coturn/coturn:4.6-alpine
COPY turnserver.conf /etc/turnserver.conf
EXPOSE 3478 3478/udp
CMD ["turnserver", "-a", "-f", "-r", "157.230.57.181"]
