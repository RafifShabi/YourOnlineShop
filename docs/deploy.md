# Como hacer actualizaciones

Se suben los cambios: git (removete => ssh://youronlineshop.net/var/lib/github) y luego en servidor hacer un git clone (/var/lib/github/)
Se reconstruye la imagen yos (no hace falta cambiar nada del source!!) asegurandose de poner la opcion --no-cache: ver "Imagen para yos". En principio no habría que reconstruir las imagenes de capas superiores pero si los contenedores: sudo docker-compose restart

# Como añadir una instancia de yos

Se crea la imagen nueva (ver Servicio yos-sample-server / Imagen). Se crean los directorios en var/lib/yos.
Se cambia site-index para que enrute al nuevo servicio.
Se crea de nuevo la imagen de site-index con la opcion --no-cache.
Se añade el servicio a docker-compose y se ejecuta de esta manera:
docker-compose up -d --no-deps --build site-index-service // aunque quiza baste con un compose simple hay que probar

-------

Antes era asi:

Cuando se quieren pasar los cambios a la web hay que tener en cuenta una serie de cuestiones:
- Hay que cambiar la configuracion de la base de datos
- Hay que cambiar la configuarción de server: basePath
- Hay que cambiar la configuarción de shared: requestUrlBasePath

Estos son los achivos y los valores a cambiar
server/dfg/dbcustom.mjs => url: "mongodb://admin:password@mongodb/yosdb?authSource=admin"
server/dfg/default.mjs => basePath: "./yos/"
shared/dfg/default.mjs => requestUrlBasePath: "sample"

En la carpeta dev/nube/digitalocean/github estan los archivos sslserverindex.mjs y firewall.mjs, no hay olvidarse de incluirlos.

Una vez realizados los cambios se pueden pasar los archivos al servidor a través de git (removete => ssh://youronlineshop.net/var/lib/github) y luego en servidor hacer un git clone (/var/lib/github/) guardandolo en la carpeta \~/docker/app.

A partir de aqui pasamos al punto situiente: Como reconstruir el contenedor de node

# Como reconstruir el contenedor de node

Si falla mi app y se hacen cambios se puede reconstruir la imagen con el comando:
docker-compose up -d --no-deps --build my-app
o simplemente
docker-compose up -d --force-recreate --no-deps my-app

----

# Situación del container

He creado unos servicios docker en el droplet de digitalocean. Estos servicios son:
- mongodb, mongoexpress y la web (la he llamado my-app)
En la app hay unos volúmenes para greenlock (certificados ssl) y para las imagenes en catalog-images. Estos volúmenes están montados en el servidor en var/lib/yos
Al hacer un deploy no hace falta configurar greenlock ni subir el directorio porque ya está configurado en el volumen y tiene los certificados.

# Como resolver errores in situ

Si falla mi app y se hacen cambios dentro del contenedor (sudo docker exec -it yos-sampe-server sh) y se hace restart del contenedor: sudo docker-compose restart yos-sample-service.
Tambien se pueden copiar archivos al contenedor mediante: sudo docker cp file.mjs yos-sample-server:/home/yos/file.mjs

Nota:
=====
Estoy entrando en el como ssh alberto@youronlineshop.net

# Creación de servicios independientes

Existe la posibilidad de crear contenedores diferentes para los servicios:
- Servicio de entrada, enrutado y ssl: index
- servicio yos_sample
- Servicio yosnet_site

Esto hará que se puedan crear nuevos servicios de forma más independiente. También se creara una imagen genérica de yos que pueda albergar en capas superiores cada una de las instalaciones.

## Imagen para yos

```
FROM node:16-alpine

ADD yos /home/yos
```
`docker build --tag yos ./`

## Servicio yos-sample-server

### Imagen

Para la imagen vamos a copiar sólo los elementos que cambian que son:
server/cfg/dbcustom.mjs => url: "mongodb://admin:password@mongodb/yossample?authSource=admin"
serverindex.mjs => const serverPort='8002';

Dockerfile
```
FROM yos

ENV MONGO_DB_USERNAME=admin \
    MONGO_DB_PWD=password

COPY ./yos-sample /home/yos

# set default dir
WORKDIR /home/yos

RUN npm install

CMD ["node", "serverindex.mjs"]
```
`docker build --tag yos-sample ./`

### Contenedor

Ahora que tenemos la imagen tenemos que crear el contenedor. Ya tenemos funcionando la base de datos y por eso hay que conectarse a esa red. (docker network ls, docker network inspect < >)
```
docker run -d \
  -p 8002:8002 \
  --name yos-sample-server \
  -v /var/lib/yos-sample/images:/home/yos/catalog-images \
  -v /var/lib/yos-sample/logs:/home/yos/logs \
  --network docker_default \
  yos-sample
```

## Servicio yos-landing-server

### Imagen

Dockerfile
```
FROM node:16-alpine

ADD landing /home/landing

# set default dir
WORKDIR /home/landing

RUN npm install

CMD ["node", "serverindex.mjs"]
```
`docker build --tag yos-landing ./`

### Contenedor

```
docker run -d \
  -p 8001:8001 \
  --name yos-landing-server \
  yos-landing
```

## Servicio index

### Imagen

Dockerfile
```
FROM node:16-alpine

ADD site-index /home/site-index

# set default dir
WORKDIR /home/site-index

RUN npm install

CMD ["node", "sslserverindex.mjs"]
```
`docker build --tag site-index ./`

### Contenedor

```
docker run -d \
  -p 8000:8000 \
  --name site-index-server \
  site-index
```

De una vez levantando los contenedores
```
version: '3' 
services: 
  site-index-service: 
    image: site-index  
    restart: always 
    container_name: site-index-server
    ports: 
      - "80:80"
      - "443:443"
    volumes:
      - "/var/lib/yos/greenlock.d:/home/site-index/greenlock.d"
    networks:
    - mynet
    depends_on:
      - yos-landing-service
      - yos-sample-service
      - yos-test-service            
  yos-landing-service: 
    image: yos-landing  
    restart: always 
    container_name: yos-landing-server 
    ports: 
    - "8001:8001" 
    networks:
    - mynet
  yos-sample-service: 
    image: yos-sample  
    restart: always 
    container_name: yos-sample-server 
    ports: 
    - "8002:8002" 
    volumes: 
      - "/var/lib/yos/sample/images:/home/yos/catalog-images" 
      - "/var/lib/yos/sample/logs:/home/yos/logs"
    networks:
    - mynet
    depends_on:
      - mongodb
  yos-test-service: 
    image: yos-test  
    restart: always 
    container_name: yos-test-server 
    ports: 
    - "8003:8003" 
    volumes: 
      - "/var/lib/yos/test/images:/home/yos/catalog-images" 
      - "/var/lib/yos/test/logs:/home/yos/logs"
    networks:
    - mynet
    depends_on:
      - mongodb
  mongodb:
    image: mongo:latest
    restart: always # allways up
    container_name: mongo-server 
    ports:
      - 27017:27017
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password
    volumes:
      - mongo-data:/data/db
    networks:
    - mynet
networks:
  mynet:
    driver: bridge
    ipam:
      driver: default
volumes:
  mongo-data:
    driver: local
```

Habria que rehacer la imagen de site-index, parar los contenedores que hay funcionando: mejor con docker-compose down desde el directorio docker y levantar los contenedores. Al levantar los contenedores con docker-compose se crean automaticamente los servicios y las networks. Se especifica mynet para darle un nombre y especificar el tipo, pero no sería necesario indicar nada.

----------

# Different containers for the web services

En lugar de hacer como hasta ahora que estamos creando los servicios de yos y yosnet con el mismo servicio node, vamos a separarlos y luego conectaros a través de un proxy. Estoy hará nuestra aplicación más facil de modificar y además estará más integrable con el desarrollo actual que se realiza de forma independiente. También podría permitir una mejor distribución de los servicios, por ejemplo se podría hacer que el servicio de descarga de archivos fuera independiente y único en todas las aplicaciones.

La realización del proxy ya está. Falta la implementación en docker.


# How to deploy yos

Guia en dev/nube/readme.md

Para yos usamos la aplicación y la utilidad para https. Actualmente se esta usando un contenedor. Se hace así por la facilidad a la hora de recomenzar la aplicación si esta falla y otras ventajas que podría haber: se espera poder crear imagenes compuestas y así crear como instancias diferentes de la app cambiando algunos archivos especificamente para cada instancia.

Crear instalaciones dependientes de una imagen fija parece sencillo (ver dockerfile). Para enrutarlas se podría hacer que cada app se comunicara con un puerto y la rama principal tendria que crear servidores para cada una de estas instancias. Para comunicarse entre puertos hay que hacerlo usando docker networks y httpProxy

Just add a network specification to you docker-compose file to use a custom bridge network.

something like that might work for you

version: '3'
services:
  api-gateway:
    container_name: api-gateway
    build: './api-gateway'
    ports:
    - "8080:8080"
    networks:
    - mynet
  user-service:
    build: ./user-service
    container_name: user-service
    ports:
    - "8093:8093"
    networks:
    - mynet

networks:
  mynet:
    driver: bridge
    ipam:
      driver: default
according to your specified ports and services in your docker-compose the following connections are now possible:

api-gateway container: user-service:8093
user-service container: api-gateway:8080
if i get it right, your api-gateway would now be:

const userServiceProxy = httpProxy(http://user-service:8093);
  this.app.post('/admin/register', async(req, res) => {
      userServiceProxy(req, res);
  });
inside a docker network you can access the ports from other containers directly (no need to specify a port-mapping to your host). probably one of your port-mappings is therefore unnecessary. if you are accessing the user-service only via api-gateway and not directly you may remove the port specification in your docker-compose files (user-service block). your user-service would then be accessible only using the api-gateway. which is probably what you want.

***********
Dockerfile:
***********
```
FROM my-app:latest

ENV MONGO_DB_USERNAME=admin \
    MONGO_DB_PWD=password

# RUN mkdir -p /home/app

# copiar solo lo que cambia
COPY ./app /home/app

# set default dir so that next commands executes in /home/app dir
WORKDIR /home/app

# create greenlock.d for volume creo que no hace falta
# RUN mkdir greenlock.d

# change yos database settings

# change yos from dev config to production config

# change yos configuration from single site to multi site

# change yos path settings: default.js

# esto crearia el directorio node_modules cambiando su contenido por tanto no cal
# RUN npm install
# RUN npm install greenlock-express@v4

# esto si haria falta para que se ejecutara en el contenedor nuevo
CMD ["node", "sslserverindex.js"]
```

## Como modificar archivos de imagenes

Dckerfile

```
FROM my-app

# notice that we are coping html content to app folder, but not the html folder
COPY ./app/html /home/app

# set default dir so that next commands executes in /home/app dir
WORKDIR /home/app

# no need for /home/app/sslserverindex.js because of WORKDIR
CMD ["node", "sslserverindex.js"]
```

## la barra al final en el url

La barra en el url signific aque las proximas peticiones del cliente tomaran como url base hasta la barra, por tanto es importante que si queremos acceder a una web y no se pone la barra al final, la web redireccione a la url con la barra al final.

