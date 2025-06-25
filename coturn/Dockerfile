FROM coturn/coturn:4.6.2
COPY turnserver.conf /etc/turnserver.conf
COPY certs/turn_server_cert.pem /certs/turn_server_cert.pem
COPY certs/turn_server_pkey.pem /certs/turn_server_pkey.pem
EXPOSE 3478
EXPOSE 3478/udp
CMD ["turnserver", "-v", "-r", "157.230.57.181"]
