
const path = require('path');
const fs = require('fs-extra');
const sharp = require('sharp');
const crypto = require('crypto');
const readline = require('readline');
const baseDir = path.resolve(__dirname);
const { createCanvas, loadImage } = require('canvas');


/*
   _____ __             __     __  __             
  / ___// /_____ ______/ /_   / / / /__  ________ 
  \__ \/ __/ __ `/ ___/ __/  / /_/ / _ \/ ___/ _ \
 ___/ / /_/ /_/ / /  / /_   / __  /  __/ /  /  __/
/____/\__/\__,_/_/   \__/  /_/ /_/\___/_/   \___/ 
     

Suggested order of operations:

1. Generate Images
2. Upload to IPFS (Do this yourself, NFTStorage)
3. Add IPFS CID
3. Remove .json if needed

*/   

// Enter Information between ""  - For example, colName = "NuArt";

// Collection Name
const colName = ""; 

// Description 
const colDesc = "";

// Website URL
const colSite = "";

// Founder Name
const colAuthor = "";

// Discord
const colDiscord = "";

// X
const colX = "";

// Background Colour
const colBg = "";



// Amount to Generate - Change number
const numGen = 10;


// Size in pixels - Change numbers
const size = { 

    width:  50, 
    height: 50 

};


// Layers Order - Top of the list is the bottom of the image 

// Last layer has no , 

const layerOrder = [
    
    // Bottom 

    '',
    '',
    '',
    ''

    // Top

];


// BaseURI link. Can leave blank. You will need to get this yourself using an IPFS provider and adding the link here and using the option.

const baseURI = ''; // insert base URI inside "/youripfslinkhere" it will append /1.png to the CID foe each item

const ethscription_id = ''; // For Ethscriptions



/*
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
    ____                               __         __             
   /  _/___ _____  ____  ________     / /_  ___  / /___ _      __
   / // __ `/ __ \/ __ \/ ___/ _ \   / __ \/ _ \/ / __ \ | /| / /
 _/ // /_/ / / / / /_/ / /  /  __/  / /_/ /  __/ / /_/ / |/ |/ / 
/___/\__, /_/ /_/\____/_/   \___/  /_.___/\___/_/\____/|__/|__/  
    /____/                                                                                                            
*/

const layersDir = path.join(baseDir, 'layers'); // Directory for the art layers
console.log("Layers Directory:", layersDir); // Add this line to check layersDir
const outputDir = path.join(baseDir, 'build', 'images'); // Directory to save the generated images
const jsonDir = path.join(baseDir, 'build', 'json'); // Directory to save JSON files
const hashListFile = path.join(baseDir, 'build', 'hashlist.txt'); // File to store image hashes
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to create a directory if it doesn't exist
async function getRandomImageFromDirectory(directory) {
    const files = await fs.readdir(directory);
    const weightedFiles = [];

    // Assign weights based on the # numbers in filenames
    files.forEach(file => {
        const match = file.match(/#(\d+)/);
        let weight = 1; // Default weight
        if (match) {
            // Use the number in the filename as weight
            weight = parseInt(match[1]); // Lower number, less weight
        }
        weightedFiles.push({ file, weight });
    });

    // Select a file randomly based on weights
    let totalWeight = 0;
    weightedFiles.forEach(({ weight }) => {
        totalWeight += weight;
    });

    let randomValue = Math.random() * totalWeight;
    let selectedFile = null;
    weightedFiles.some(({ file, weight }) => {
        if (randomValue < weight) {
            selectedFile = file;
            return true;
        }
        randomValue -= weight;
        return false;
    });

    return path.join(directory, selectedFile);
}
// Clear Hash list
async function clearHashList() {
    try {
        await fs.promises.truncate(hashListFile, 0);
        console.log('Cleared hashlist.txt.');
    } catch (error) {
        console.error('Error clearing hashlist.txt:', error);
    }
}
// Image generation functions
async function generateImages(amount) {
    try {
        await fs.ensureDir(layersDir);
        await fs.ensureDir(outputDir);
        await fs.ensureDir(jsonDir);
        await fs.emptyDir(outputDir);
        await fs.emptyDir(jsonDir);
        console.log('Cleared output and JSON directories.');

        // Create hashlist.txt if doesn't exist
        if (!fs.existsSync(hashListFile)) {
            await fs.writeFile(hashListFile, '');
        }

        // Clear hashlist.txt
        await clearHashList();

        // Read existing hashes from hashlist.txt
        const hashListData = await fs.promises.readFile(hashListFile, 'utf-8');
        const existingHashes = new Set(hashListData.trim().split('\n'));

        // Generate images sequentially
        for (let i = 1; i <= amount; i++) {
            await generateRandomImage(i, existingHashes);
        }

        console.log('Image generation completed.');
        await generateMetadata();

    } catch (error) {
        console.error('An error occurred:', error);
    }
}
async function generateRandomImage(index, hashList) {
    try {
        let uniqueImageGenerated = false;
        let outputFilePath, imageHash, imageAttributes;

        while (!uniqueImageGenerated) {
            // Get the size of the first trait
            const firstLayerDir = path.join(layersDir, layerOrder[0]);
            const firstImagePath = await getRandomImageFromDirectory(firstLayerDir);
            const firstImage = await loadImage(firstImagePath);
            const traitWidth = firstImage.width;
            const traitHeight = firstImage.height;

            // Create canvas with trait size
            const canvas = createCanvas(traitWidth, traitHeight);
            const ctx = canvas.getContext('2d');

            // Reset imageAttributes for each iteration
            imageAttributes = { index, hash: imageHash };

            for (const layerName of layerOrder) {
                const layerDir = path.join(layersDir, layerName);
                const imagePath = await getRandomImageFromDirectory(layerDir);
                
                // Extract the filename from imagePath and remove the #number part
                let fileName = path.basename(imagePath, path.extname(imagePath));
                fileName = fileName.replace(/#\d+$/, ''); // Remove the #number part
                
                imageAttributes[layerName] = fileName;
                
                if (fs.existsSync(imagePath)) {
                    const image = await loadImage(imagePath);
                    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                }
            }

            // Write the canvas to an image file
            outputFilePath = path.join(outputDir, `${index}.png`);
            await fs.promises.writeFile(outputFilePath, canvas.toBuffer());

            // Calculate hash of the image
            const hash = crypto.createHash('sha256');
            hash.update(canvas.toBuffer());
            imageHash = hash.digest('hex');

            console.log(`Generated image #${index} | DNA - ${imageHash}`);

            // Check if the hash already exists in the hash list
            if (!hashList.has(imageHash)) {
                uniqueImageGenerated = true;
                hashList.add(imageHash);
            } else {
                console.log(`Image with hash ${imageHash} already exists. Regenerating...`);
                await fs.promises.unlink(outputFilePath);
            }
        }

        // Upscale the generated image to the requested export size (values from the size variable)
        const upscaleWidth = size.width;
        const upscaleHeight = size.height;
        const outputBuffer = await sharp(outputFilePath)
            .resize(upscaleWidth, upscaleHeight, { kernel: sharp.kernel.nearest })
            .toBuffer();

        // Overwrite the image file with the upscaled version
        await fs.promises.writeFile(outputFilePath, outputBuffer);

        // Save image data
        await saveImageData(index, outputFilePath, imageAttributes, imageHash); // Pass imageHash here
    } catch (error) {
        console.error('An error occurred:', error);
    }
}
// Function to save image and json data
async function saveImageData(index, imagePath, imageAttributes, imageHash) {
    try {
        const attributes = layerOrder.map((layerName) => {
            const trait_type = layerName;
            const value = imageAttributes[layerName] || ""; // Get the filename from imageAttributes or empty string if not found
            return { trait_type, value };
        }).filter(attribute => attribute.value !== "None"); // Exclude attributes with value "None"
        // add total trait count to attributes
        attributes.push({ trait_type: "Total Traits", value: attributes.length.toString() });

        const jsonData = {
            name: `${colName} #${index}`,
            image: "",
            ethscription_id,
            hash: imageHash,
            description: "",
            external_url: "",
            background_color: "",
            item_index: index,
            attributes: attributes
        };

        const jsonFilePath = path.join(jsonDir, `${index}.json`);

        // Save JSON file with .json attachment
        await fs.writeJson(jsonFilePath, jsonData, { spaces: 2 });

        // Append hash to hashlist.txt
        await fs.appendFile(hashListFile, `${imageHash}\n`);

    } catch (error) {
        console.error('Error saving image data:', error);
    }
}
// Function to generate metadata
async function generateMetadata() {
    try {
        const metadata = {
            "name": colName, // Set collection name as specified in colName
            "description": colDesc.toString(),
            "total_supply": numGen.toString(), // Set total supply as the number of images generated
            "website": colSite.toString(),
            "Founder": colAuthor.toString(), // Set author as specified in colAuthor
            "X": colX.toString(),
            "discord": colDiscord.toString(), // Set discord as specified in colDiscord
            "logo_image_uri": "",
            "banner_image_uri": "",
            "background_color": colBg.toString(),
            "compiler": "Nu Art Generator by Ryo",
            "collection_items": []
        };

        for (let i = 1; i <= numGen; i++) {
            const filePath = path.join(jsonDir, `${i}.json`);
            if (fs.existsSync(filePath)) {
                const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

                let allAttributesValid = true;

                // Check each attribute individually for "None" value
                for (const attribute of jsonData.attributes) {
                    if (attribute.value === "None") {
                        allAttributesValid = false;
                        break;
                    }
                }

                // Only add the item to collection_items if all attributes are valid
                if (allAttributesValid) {
                    const item = {
                        "name": jsonData.name,
                        "image": "",
                        "hash": jsonData.hash,
                        "ethscription_id": "",
                        "description": jsonData.description || "",
                        "external_url": jsonData.external_url || "",
                        "background_color": "",
                        "item_index": jsonData.item_index,
                        "item_attributes": jsonData.attributes
                    };
                    metadata.collection_items.push(item);
                }
            } else {
                console.error(`JSON file for index ${i} not found.`);
            }
        }

        const metadataFilePath = path.join(baseDir, 'build', colName.toString() + '_metadata.json');
        fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 2));

        console.log("Metadata file generated successfully:", metadataFilePath);
    } catch (error) {
        console.error('Error generating metadata file:', error);
    }

}
// Main function
async function main() {
    try {
        let shouldReturnToMenu = true;

        while (shouldReturnToMenu) {
            const choice = await getUserChoice();

            switch (choice) {
                case '1':
                    await generateImages(numGen);
                    break;
                case '2':
                    await addBaseURI(baseURI, jsonDir);
                    break;
                case '3':
                    await removeJsonExtensions(jsonDir);
                    break;
                case '4':
                    uploadToIPFS();
                    break;
                case '5':
                    addEthscriptionId();
                    break;
                default:
                    console.log('\x1b[31mInvalid choice. Please enter a number between \x1b[36m1\x1b[31m and \x1b[36m4\x1b[31m.\x1b[0m');
                    break;
            }

            // Ask user if they want to return to the menu after generating images
            const returnChoice = await askToReturnToMenu();
            shouldReturnToMenu = (returnChoice.toLowerCase() === 'y');
        }

        rl.close(); // Close readline interface when done
    } catch (error) {
        console.error('\x1b[31mAn error occurred:\x1b[0m', error);
    }
}
// Function to get user choice
function getUserChoice() {
    return new Promise((resolve, reject) => {
        rl.question('\x1b[36mPlease choose an option:\n\x1b[36m1. \x1b[0mGenerate Images\n\x1b[36m2. \x1b[0mAdd Base URI\n\x1b[36m3. \x1b[0mRemove .json Extensions\n\x1b[36m4. \x1b[0mUpload to IPFS (Coming Soon)\n\x1b[36m5. \x1b[0mAdd Ethscription ID\n\x1b[36mChoice: \x1b[0m', (answer) => {
            resolve(answer);
        });
    });
}
// Function to ask user if they want to return to the menu
function askToReturnToMenu() {
    return new Promise((resolve, reject) => {
        rl.question('\x1b[36mDo you want to return to the menu? \x1b[0m(\x1b[32mY\x1b[0m/\x1b[35mN\x1b[0m): ', (answer) => {
            resolve(answer);
        });
    });
}
// Function to add base URI to JSON files
async function addBaseURI(baseURI, jsonDir) {
    try {
        // Read all JSON files in the directory
        const jsonFiles = await fs.readdir(jsonDir);

        // Iterate through each JSON file
        for (const jsonFile of jsonFiles) {
            // Read the JSON data
            const filePath = path.join(jsonDir, jsonFile);
            const jsonData = require(filePath); // Assuming JSON files are in proper format

            // Update the "image" field with the base URI
            jsonData.image = `${baseURI}/${jsonFile.split('.')[0]}.png`;

            // Write the modified JSON back to the file
            await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2));

            console.log(`Base URI added to ${jsonFile}`);
        }

        console.log('Base URI added to all JSON files successfully.');
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

//  not complete 
async function addEthscriptionId(ethscription_id, jsonDir) {
    try {
        // Read all JSON files in the directory
        const jsonFiles = await fs.readdir(jsonDir);

        // Iterate through each JSON file
        for (const jsonFile of jsonFiles) {
            // Read the JSON data
            const filePath = path.join(jsonDir, jsonFile);
            const jsonData = require(filePath); // Assuming JSON files are in proper format

            // Update the "image" field with the base URI
            jsonData.ethscription_id = ethscription_id;

            // Write the modified JSON back to the file
            await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2));

            console.log(`Base URI added to ${jsonFile}`);
        }

        console.log('Base URI added to all JSON files successfully.');
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

// Function to remove .json extensions from JSON files
async function removeJsonExtensions(jsonDir) {
    try {
        // Read all JSON files in the directory
        const jsonFiles = await fs.readdir(jsonDir);

        // Iterate through each JSON file
        for (const jsonFile of jsonFiles) {
            // Check if the file has .json extension
            if (jsonFile.endsWith('.json')) {
                // Remove the .json extension
                const newFileName = jsonFile.replace('.json', '');

                // Rename the file
                const oldPath = path.join(jsonDir, jsonFile);
                const newPath = path.join(jsonDir, newFileName);
                await fs.rename(oldPath, newPath);

                console.log(`Removed .json extension from ${jsonFile}`);
            }
        }

        console.log('Removed .json extension from all JSON files successfully.');
    } catch (error) {
        console.error('An error occurred:', error);
    }
}
// Function to upload to IPFS - not complete
function uploadToIPFS() {
    // Your implementation here
    console.log('Uploading to IPFS...');
}
// Call the main function
main();
