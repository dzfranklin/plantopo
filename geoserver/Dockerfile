FROM docker.osgeo.org/geoserver:2.23.1
ARG os_key

COPY ./geoserver_data /opt/geoserver_data
RUN rm -r /opt/geoserver_data/security
RUN bash -c 'rm -r /opt/apache-tomcat-9.0.74/webapps/geoserver/WEB-INF/lib/gs-{web,rest}*.jar'
RUN sed -i "s/{{PT_OS_KEY}}/${os_key}/" /opt/geoserver_data/workspaces/ne/os_raster/wmtsstore.xml

ENTRYPOINT [ "/bin/sh", "-c", "/opt/startup.sh" ]
