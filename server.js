const express = require('express');
const app = express();
const pug = require('pug');
const PORT = 4131;
const bcrypt = require('bcrypt');
const data = require('./data');
const session = require('express-session');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("views", "templates");
app.set("view engine", "pug");
app.use('/css', express.static('resources/css'));
app.use('/js', express.static('resources/js'));
app.use('/images', express.static('resources/images'));

app.use(session({
    secret: 'pefPBxwf+rqfCcNLoMjzlA==',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Internal Server Error.');
});


app.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        const posts = await data.getPosts(limit, offset);
        const totalPosts = await data.getPostCount();

        const pagination = {
            prev: page > 1 ? page - 1 : null,
            next: totalPosts > offset + limit ? page + 1 : null
        };

        res.render('main', { posts, pagination });
    } catch (error) {
        console.error(error);
        res.status(500).render('main', { error: 'Error fetching posts.' });
    }
});
// Display the registration form
app.get('/register', (req, res) => {
    res.render('register');
});

// Display the login form
app.get('/login', (req, res) => {
    res.render('login');
});

// Post creation form
app.get('/create-post', (req, res) => {
    if (!req.session.userId) {
        // User is not logged in, redirect to login page
        res.redirect('/login');
    } else {
        res.render('createPost');
    }
});

// Viewing an individual post
app.get('/post/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        const post = await data.getPostById(postId);
        const userId = req.session.userId;
        res.render('post', { post , userId});
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { error: 'Error fetching post.' });
    }
});

// Post edit form
app.get('/edit-post/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        const post = await data.getPostById(postId);
        res.render('editPost', { post });
    } catch (error) {
        console.error(error);
        res.render('editPost', { error: 'Error fetching post for editing.' });
    }
});

// Handle logging out
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if(err) {
            console.error(err);
            return res.redirect('/');
        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

// Handle the registration form submission
app.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        // Validation empty fields and correct format
        if (!username || !email || !password) {
            throw new Error('All fields are required');
        }
        if (!/\S+@\S+\.\S+/.test(email)) {
            throw new Error('Invalid email format');
        }
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters long');
        }
        // Check if username or email already exists
        const existingUser = await data.getUserByUsernameOrEmail(username, email);
        if (existingUser) {
            throw new Error('Username or email already in use');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await data.addUser(username, email, hashedPassword);
        res.redirect('/login');
    } catch (error) {
        console.error(error);
        res.status(400).render('register', { error: error.message });
    }
});

// Handle the login submission
app.post('/login', async (req, res) => {
    try {
        const { credential, password } = req.body; // credential can be either username or email
        if (!credential || !password) {
            throw new Error('Username/email and password are required');
        }
        // Get user from the database
        const user = await data.getUserByUsernameOrEmail(credential, credential);
        if (!user) {
            throw new Error('Invalid login credentials');
        }
        // Compare provided password with the hashed password in the database
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            throw new Error('Invalid login credentials');
        }
        req.session.userId = user.id;
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(400).render('login', { error: error.message });
    }
});

// Handle post creation
app.post('/create-post', async (req, res) => {
    try {
        const { content } = req.body;
        const userId = req.session.userId;
        await data.addPost(userId, content);
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(400).render('createPost', { error: 'Error creating post.' });
    }
});

// Post update handling
app.post('/edit-post/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        const { content } = req.body;
        const userId = req.session.userId;
        console.log(content);
        console.log(postId);
        console.log(userId);
        await data.updatePost(postId, userId, content);
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(400).render('editPost', { error: 'Error updating post.' });
    }
});

// Handling post deletion
app.delete('/post/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.session.userId;
        await data.deletePost(postId, userId);
        res.status(200).send({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting post');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
