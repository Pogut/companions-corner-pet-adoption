const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// Explicitly define the views directory
const viewsPath = path.join(__dirname, 'views');
app.set('view engine', 'ejs');
app.set('views', viewsPath);

// Log the path to check if it's correct
console.log(`Views directory is set to: ${viewsPath}`);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'your_secret_key',  // Choose a strong secret for session encryption
    resave: false,
    saveUninitialized: false,  // Prevents login sessions from being initialized without a login
    cookie: { secure: false }  // Set true if you're using HTTPS
}));



app.get('/', (req, res) => {
    res.render('index', { title: 'Home', user: req.session.user });
});

app.get('/dog_care', (req, res) => {
    res.render('dog_care', {user: req.session.user} );
});
app.get('/cat_care', (req, res) => {
    res.render('cat_care', {user: req.session.user});
});

app.get('/find', (req, res) => {
    res.render('find', {user: req.session.user});
});

app.get('/contact', (req, res) => {
    res.render('contact', {user: req.session.user});
});

app.get('/create_account', (req, res) => {
    res.render('create_account', {
        title: 'Companion\'s Corner - Create an Account',
        user: req.session.user || null, // If there's a user session, pass the username; otherwise, pass null
        message: '' // And any other data your template expects
    });
});




const loginsFilePath = path.join(__dirname, 'logins.txt'); // Path to your logins.txt file

app.post('/create_account', express.urlencoded({ extended: true }), (req, res) => {
    const { username, password } = req.body;

    fs.readFile(loginsFilePath, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.writeFile(loginsFilePath, `${username}:${password}\n`, (err) => {
                    if (err) {
                        console.error('Error writing new user to file:', err);
                        return res.status(500).send('Error creating your account.');
                    }
                    req.session.user = username;
                    res.redirect('/'); // Corrected from res.render('/')
                });
            } else {
                console.error('Error reading the logins file:', err);
                return res.status(500).send('Error processing your request.');
            }
        } else {
            const lines = data.trim().split('\n');
            const existingUser = lines.find(line => line.startsWith(`${username}:`));
            if (existingUser) {
                res.render('create_account', { message: 'Username is already taken!', user: null });
            } else {
                fs.appendFile(loginsFilePath, `${username}:${password}\n`, (err) => {
                    if (err) {
                        console.error('Error saving new user:', err);
                        return res.status(500).send('Error creating your account.');
                    }
                    req.session.user = username;
                    res.redirect('/'); // This ensures the session user is available on the homepage
                });
            }
        }
    });
});


// Login page route
app.get('/logins', (req, res) => {
    res.render('logins', { message: null , user: req.session.user});
});

app.post('/logins', express.urlencoded({ extended: true }), (req, res) => {
    const { username, password } = req.body;

    fs.readFile(loginsFilePath, 'utf8', (err, data) => {
        if (err) throw err;

        const lines = data.trim().split('\n');
        const validUser = lines.find(line => line === `${username}:${password}`);
        if (validUser) {
            // If the login is successful, set the user in the session
            req.session.user = username;
            // Redirect to the originally intended giveaway page
            res.redirect('/giveaway');
        } else {
            // If login fails, render the login page with an error message
            res.render('logins', { message: 'Invalid username or password. Please try again.' });
        }
    });
});

app.get('/giveaway', (req, res) => {
    if (!req.session.user) {
        // If there's no user session, redirect to the login page
        res.redirect('/logins');
    } else {
        // If user is logged in, render the giveaway page
        res.render('giveaway', {user: req.session.user});
    }
});


app.post('/register_pet', express.urlencoded({ extended: true }), (req, res) => {
    if (!req.session.user) {
        // Redirect to login if the user is not logged in
        return res.redirect('/logins');
    }

    // Extract form data
    const { animal_type, breed, age, gender, gets_along_dogs, gets_along_cats, suitable_for_children, comments, owner_name, owner_email } = req.body;

    // Prepare additional info string from checkboxes and comments
    let additionalInfo = [
        gets_along_dogs ? "Yes" : "No",
        gets_along_cats ? "Yes" : "No",
        suitable_for_children ? "Yes" : "No",
        comments
    ].join(':');

    const availablePetsFilePath = path.join(__dirname, 'availablePets.txt');

    // Read and update available pets file
    fs.readFile(availablePetsFilePath, 'utf8', (err, data) => {
        if (err && err.code !== 'ENOENT') {
            console.error('Error reading the pets file:', err);
            return res.status(500).send('Error processing your request.');
        }

        const lines = data ? data.trim().split('\n') : [];
        const petId = lines.length + 1; // Incremental ID based on the file lines
        const newPetEntry = `${petId}:${req.session.user}:${animal_type}:${breed}:${age}:${gender}:${additionalInfo}:${owner_name}:${owner_email}\n`;

        // Append new pet entry to file
        fs.appendFile(availablePetsFilePath, newPetEntry, (err) => {
            if (err) {
                console.error('Failed to save the pet data:', err);
                return res.status(500).send('Failed to register the pet.');
            }
            res.send('Pet registered successfully.'); // Or render a page to show success
        });
    });
});

app.post('/search_pets', express.urlencoded({ extended: true }), (req, res) => {
    const { animal_type, breed, age, gender, breed_doesnt_matter } = req.body;
    const breedMatters = !breed_doesnt_matter || breed_doesnt_matter !== 'on'; // 'on' if checkbox is checked

    fs.readFile(path.join(__dirname, 'availablePets.txt'), 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the pets file:', err);
            return res.status(500).send('Error processing your request.');
        }

        let results = data.trim().split('\n').filter(line => {
            const parts = line.split(':');
            // Assuming parts indexes: 0=id, 1=user, 2=type, 3=breed, 4=age, 5=gender, ...additional info
            const [id, user, type, petBreed, petAge, petGender] = parts;

            // Start assuming a match
            let matches = true;

            // Check if the type matches, if specified
            if (animal_type !== 'doesnt_matter' && type.toLowerCase() !== animal_type.toLowerCase()) matches = false;

            // Check if the breed matches, if specified and matters
            if (breedMatters && petBreed.toLowerCase() !== breed.toLowerCase()) matches = false;

            // Check if the age matches, if specified
            if (age !== 'doesnt_matter' && petAge.toLowerCase() !== age.toLowerCase()) matches = false;

            // Check if the gender matches, if specified
            if (gender !== 'doesnt_matter' && petGender.toLowerCase() !== gender.toLowerCase()) matches = false;

            return matches;
        });

        // If no results, provide a message
        if (results.length === 0) {
            results = ["Sorry there are no specific matches for you currently :("];
        }

        // Render the page with the filtered results
        res.render('find', { results: results, user: req.session.user });
    });
});

// The Log out route
app.get('/logout', (req, res) => {
    // Destroy the session and redirect to the home page
    req.session.destroy(err => {
        if (err) {
            console.error('Failed to destroy the session during logout:', err);
            return res.status(500).send('An error occurred while logging out.');
        }
        // Optionally, clear the cookie if you set one for the session
        res.clearCookie('connect.sid'); // The name of the cookie storing session ID might be different in your case
        res.redirect('/');
    });
});


app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
