//DEPENDENCIES
const chalk         = require('chalk');
const dotenv        = require('dotenv');
const hbs           = require('hbs');
const mongoose      = require('mongoose');
const express       = require('express');
const bodyParser    = require('body-parser');
const bcrypt        = require('bcrypt')
const session       = require('express-session')
const MongoStore    = require('connect-mongo')(session)

//CONSTANTS
const app = express();
//MODELS
const Videogame = require('./models/Videogame.js')
const User = require('./models/User.js')


//CONFIGURATION

//config. .env
require('dotenv').config();

//config mongoose
mongoose.connect(`mongodb://localhost/${process.env.DATABASE}`, {
		useCreateIndex: true,
		useNewUrlParser: true,
		useUnifiedTopology: true,
		useFindAndModify: false
})
.then((result) => {
    console.log(chalk.blue(`Connected to Mongo! Database used: ${result.connections[0].name}`));
})
.catch((error) => {
    console.log(chalk.red(`There has been an error: ${error}`));
});

//config. hbs
app.set('view engine', 'hbs');
app.set('views', __dirname + '/views')
hbs.registerPartials(__dirname + "/views/partials")

//config. static folder
app.use(express.static(__dirname + '/public')) 

//config. body parser
app.use(bodyParser.urlencoded({extended: true}))

//config. cookies
app.use(session({
    secret: "basic-auth-secret",
    // cookie: { maxAge: 60000 }, => se comenta para que la sesion dure hasta que nosotros la cerremos, y no ese tiempo establecido
    store: new MongoStore({
      mongooseConnection: mongoose.connection,
      ttl: 24 * 60 * 60 // 1 day
    }),
    saveUninitialized: true,
    resave: true
}));
  


//RUTES  ==> ATENCION: a medida que vamos creando las rutas GET recomendado ir protegiendo con condicional de sesion iniciada
                      // mejor se puede hacer con el MIDDLEWARE y el NEXT, te ahorras lo de arriba de repetir los "IFs"; pero CUIDADO con poner las rutas de HOME, LOGIN y SIGNUP por debajo del MIDDLEWARE, eso hace imposible registrarse (tambien borrar cookies si da problemas)

//RUTA GET DE LA HOME PAGE
app.get('/', (req, res, next)=>{
    
    // const newVideogame = {
    // name: 'ZELDA ocarina of time',
    // developer: 'Nintendo',
    // platform: ['nintendo 64', 'game cube', 'ique player'],
    // genre: ['accion', 'adventure'],
    // releaseDate: '1998-12-11',
    // rating: 99,
    // pegi: '12'
    // }

    // Videogame.create(newVideogame)
    //     .then(result=>console.log(result))
    //     .catch(error=>console.log(`error`))
    
    res.render('home', {session: req.session.currentUser})
})

//RUTAS GET Y POST PARA CREAR Y REGISTRAR UN NUEVO USUARIO
app.get('/sign-up', (req, res, next) => {
    res.render ('signUp')
})

app.post('/sign-up', (req, res, next) => {
    //console.log(req.body)
    
    // const email = get.body.email;
    // const pass = get.body.password;
    
    //desestructuring; this is the same as above
    const {email, password} = req.body
    //console.log(email, password)

    User.findOne({email: email})
    .then(result => {
        if(!result) {
            bcrypt.genSalt(10)
            .then(salt => {
                bcrypt.hash(password, salt)
                .then((hashedPassword) => {
                    const hashedUser = {email: email, password: hashedPassword};
                    //hashedUser = {email, password: ''} => en JS al crear objeto literal, si key = value se pone solo 1 vez
                    User.create(hashedUser)
                    .then(() => {
                        res.redirect('/') 
                    })
                })
            })
        } else {
            res.render('logIn', {errorMessage: "This user is alredy in use"})
        }
    })
    .catch(err => {
        res.send(err)
    })
})


//RUTAS GET Y  POST PARA IDENTIFICARSE COMO USUARIO EXISTENTE

app.get('/log-in', (req, res, next) => {
    res.render ('logIn')
})

app.post('/log-in', (req, res, next) => {
    //console.log(req.body) => Buena practica hacer de primeras console.log() para comprobar qué recibimos

    const {email, password} = req.body

    User.findOne({email: email}) // => CUIDADO aquí: esnecesario poner el parametro y su valor (pasado como variable en este segundo caso)
    .then(result => {
        //console.log(result) => para cmprobar que nos da "null" como resultado de no encontrar coincidencia
        if(!result) {
            //console.log('El usuario no existe')
            res.render('logIn', {errorMessage: "Este usuario no existe"})
        } else {
            bcrypt.compare(password, result.password)
            .then(resultFromBcrypt => {
                if(resultFromBcrypt) {
                    //AQUÍ crearemos la sesion de usuario, con cookies para que no se cierre => se hace con el package "express-session" de npm. Tambien necesario instalar "conenct-mongo", porque estas sesiones se guardan en la base de datos (mongo en este caso).
                    req.session.currentUser = email //nombre al que se vincula la sesion. email en este caso
                    console.log(req.session)
                    res.redirect('/')
                    //req.session.destroy() => metodo para cerrar sesion
                } else {
                    res.render('logIn', {errorMessage: "Wrong password. Please try again"})
                }
            })
                
        }
    })
})


app.use((req, res, next) => {
    if(req.session.currentUser) {
        next();
    } else {
        res.redirect('/log-in')
    }
})


//RUTA GET PARA RENDERIZAR EL FORMULARIO DE CREACION DE UN VIDEOJUEGO
app.get('/new-videogame', (req, res, next)=>{
    if(req.session.currentUser) {
        res.render('newVideogame')
    } else {
        res.redirect('/log-in')
    }
    
})


//RUTA POST PARA CREAR UN NUEVO VIDEOJUEGO
app.post('/new-videogame', (req, res, next)=>{

    const splitString = (_string)=>{
        const genreString = _string
        const splitedGenreString = genreString.split(', ')
        return splitedGenreString
    }

    const arrayPlatform = splitString(req.body.platform)
    const arrayGenre = splitString(req.body.genre)
    
    const newVideogame = {...req.body, platform: arrayPlatform, genre: arrayGenre}

    
    Videogame.create(newVideogame)
    .then(result=>{
        //console.log(result)
        User.updateOne({email: req.session.currentUser}, {$push: {videogames: result._id}}) //=> buscar al usuario por la sesion activa para incluir el juego creado en su propia coleccion (y la general tambien)
        .then() // =>> ATENCION: puede que NO funcione sin .then(), aunque sea vacío 
        res.redirect('/all-videogames') 
    })
    .catch(error=>console.log(error))
})

//RUTA GET PARA VER PAGINA CON TODOS LOS VIDOJUEGOS
app.get('/all-videogames', (req, res, next)=>{
    // if(req.session.currentUser) {
    //     Videogame.find({}, {name: 1, _id: 1, imageUrl: 1})
    //     .then(videogames=>{
    //         console.log()
    //         res.render('all-videogames', {videogames})
    //     })
    //     .catch(error=> {
    //         console.log(error)
    //         res.send(error)
    //     })
    // } else {
    //     res.redirect('/log-in')
    // }

    User.findOne({email: req.session.currentUser})
    .populate('videogames') // => metodo de mongoose para completar los datos del campo pasado como parametro del "populate", relacionandolos con la coleccion establecida en el Schema mediante el "ref"
    .then(user => {
        //console.log(result)
        const userVideogameCollection = user.videogames
        res.render('all-videogames', {videogames: userVideogameCollection}) // => se podria llamar a "userVideogameCollection" igual que "videogames" para poner: res.render('all-videogames', {videogames})
    })
    .catch(err => {
        console.log(err)
    })
})

//RUTA GET PARA VER PAGINA PERSONALIZADA DE UN VIDEOJUEGO
// /videogame/5
app.get('/videogame/:id', (req, res, next)=>{
    if(req.session.currentUser) {
        const videogameId = req.params.id;
        //console.log(req.params)
        Videogame.findById(videogameId)
        .then((result)=>{
            res.render('single-videogame', result)
        })
        .catch((error)=>{
            console.log(error)
            res.render(error)
        })
    } else {
        res.redirect('/log-in')
    }

    
    //console.log(req.query)
})

//RUTA POST PARA ELIMINAR UN VIDEOJUEGO
app.post('/delete-game', (req, res, next)=>{
    const id = req.query.id
    Videogame.findByIdAndDelete(id)
    .then(()=>{
        res.redirect('/all-videogames')
    })
    .catch(error=>{
        console.log(error)
        res.send(error)
    })
})

//RUTA GET PARA VER EL FORMULARIO DE EDICION DE UN JUEGO ESPECIFICO
app.get('/edit-videogame/:id', (req, res, next)=>{
    
    if(req.session.currentUser) {
        const id = req.params.id
    
        Videogame.findById(id)
        .then(result=>{
            res.render('edit-form', result)
        })
        .catch(error=>{
            console.log(error)
            res.send(error)
        })
    } else {
        res.redirect('/log-in')
    }
})

//RUTA POST PARA EDITAR UN JUEGO ESPECIFICO
app.post('/edit-videogame/:id', (req, res, next)=>{
    const id = req.params.id 
    const editedVideogame = req.body

    Videogame.findByIdAndUpdate(id, editedVideogame)
        .then(result => {
            res.redirect(`/videogame/${id}`)
        })
        .catch(error=>{
            console.log(error)
            res.send(error)
        })

    console.log(req.body)
})





//RUTA GET(POSIBLE POST?) PARA LOG-OUT
app.get("/log-out", (req, res, next) => {
    req.session.destroy()
    res.redirect('/')
})


//LISTENER
app.listen(process.env.PORT, ()=>{
    console.log(chalk.blue.inverse.bold`conectedd to port ${process.env.PORT}`)
})


