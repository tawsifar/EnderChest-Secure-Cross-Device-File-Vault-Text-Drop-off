Yes. 

# EnderChest

### Cross-device file and text sharing without accounts, cables, or complicated setup.

**Live Demo:** https://enderchest.ai.studio

---

## 💡 Why would we need this?

Sometimes you just need to move a file from one device to another without signing into an account, connecting a cable, or installing anything.

For example:

- **Phone to a random PC:** Transfer a file to a public or unfamiliar computer without logging into your personal cloud storage.
- **Cybercafes and university labs:** Move documents without USB drives or cables.
- **Group projects:** Give multiple people access to the same files or text without requiring everyone to create an account.
- **Temporary collaboration:** Share files or notes without setting up a full collaboration platform.
- **Device-to-device text sharing:** Quickly move code, links, commands, notes, or snippets between devices.
- **Remote assistance:** Put a file or piece of information in a room and share the room ID with someone else.

The idea is simple:

```text
Create a room
     ↓
Get a unique ID
     ↓
Add files or text
     ↓
Open the same ID on another device


---

📦 What is EnderChest?

EnderChest is a Minecraft-inspired web application for transferring files and text between devices using a unique room ID instead of a traditional account system.

It was built as a full-stack prototype to explore frontend and backend development, database integration, cloud storage, APIs, and cloud deployment.

The concept is inspired by Minecraft's Ender Chest, which allows the same storage to be accessed from different locations.


---

Features

Room-based file and text sharing

No account required

No password required in the current prototype

File upload and download

Shared text area

SHA-256 hashing for relevant room and identifier handling

Cloud-based file storage

Persistent database for room and file metadata

Direct-to-cloud file uploads

Responsive desktop and mobile interface

Minecraft-inspired UI



---

🛠️ Engineering

A major part of the project was connecting and configuring the different services required to make the application work as a complete system.

Supabase and PostgreSQL

Supabase is used as the PostgreSQL database layer.

It stores:

Room information

Room identifiers

Shared text

File metadata

File references

Upload information


The backend communicates with Supabase through the application's API layer rather than exposing sensitive service credentials to the browser.


---

Google Drive and Direct-to-Cloud Uploads

Files are stored using Google Drive infrastructure instead of being stored directly on the application server.

The backend creates an authenticated Google Drive upload session, after which the browser can upload the file directly to Google Drive.

Browser
   ↓
Express Server
   ↓
Create upload session
   ↓
Browser receives upload information
   ↓
Browser ───────────────→ Google Drive
             File
   ↓
Upload completed
   ↓
File metadata → Supabase

This reduces the amount of large binary data that the Node.js server needs to process.


---

SHA-256 Hashing

EnderChest uses SHA-256 hashing for relevant room and identifier handling.

SHA-256 is a hashing algorithm, not encryption. It provides a deterministic representation of data but does not make the application an encrypted storage service or replace proper authentication.


---

Backend API

The backend uses Node.js and Express as the API layer between the frontend, database, and external cloud services.

It handles tasks such as:

Room operations

Database communication

Google Drive API communication

Creating upload sessions

Server-side credentials

File metadata

Communication between application components



---

Cloud Deployment

The application is containerized with Docker and deployed using Google Cloud.

The deployment involved working with:

Docker

Google Cloud Console

Cloud Run

Environment variables

API configuration

Google Drive API

Service authentication

Production deployment configuration



---

🏗️ High-Level Architecture

┌────────────────────┐
                         │      Browser       │
                         │ React + TypeScript │
                         └─────────┬──────────┘
                                   │
                              API Requests
                                   │
                                   ▼
                         ┌────────────────────┐
                         │   Express Server   │
                         │    Node.js API     │
                         └───────┬─────┬──────┘
                                 │     │
                         Database│     │Cloud Storage
                                 │     │
                                 ▼     ▼
                         ┌──────────┐  ┌──────────────┐
                         │ Supabase │  │ Google Drive │
                         │PostgreSQL│  │     API      │
                         └──────────┘  └──────────────┘
                                      
                              Deployed with
                                   │
                                   ▼
                         ┌────────────────┐
                         │  Google Cloud  │
                         │    Cloud Run   │
                         └────────────────┘


---

🛠️ Tech Stack

Area	Technology

Frontend	React, TypeScript, Vite
Styling	Tailwind CSS
Icons	Lucide Icons
Backend	Node.js, Express
Database	Supabase / PostgreSQL
Storage	Google Drive API
Cloud	Google Cloud / Cloud Run
Containerization	Docker
Hashing	SHA-256
Version Control	Git / GitHub



---

🔐 What Should You Store?

EnderChest is currently a prototype, not a replacement for secure cloud storage or a password manager.

The current access system is based around a unique room ID and does not yet have a full account/password system.

Users should therefore use data that:

They use regularly

They may need to move between devices

Is useful to have temporarily available

Would not cause serious problems if exposed


Examples include university documents, project files, images, presentations, links, and code snippets.

Avoid using the prototype for highly sensitive information such as:

Passwords

Financial credentials

Private identity documents

Authentication keys

Confidential personal information


The intended use is practical, regularly used data rather than highly sensitive information.


---

⚠️ Prototype Limitations

EnderChest is intentionally being kept as a prototype.

No Password or Account System

Rooms currently do not have passwords or user accounts. This was a deliberate choice to keep the prototype simple and make the main file-sharing workflow quick.

A proper authentication system can be added later based on user requirements.

No Forgot Password System

Since there is currently no account/password system, there is no traditional "Forgot Password" feature.

The room's unique ID is currently required to access the room.

Users should remember or safely keep their own unique ID.

If the ID is forgotten, there is currently no account-based recovery mechanism.

Security Limitations

Although the project uses SHA-256 hashing and cloud infrastructure, the current access model should not be considered equivalent to a production-grade authenticated storage platform.

Users should avoid storing highly vulnerable or extremely sensitive information.


---

🔮 Future Improvements

The project will remain primarily a prototype. Potential improvements may include:

Password-protected rooms

User accounts

Forgot-password / account recovery

More granular access control

Room expiration

Better file management

File deletion

Improved upload progress

Stronger authentication

Additional storage providers

More advanced sharing permissions


Future features will depend on actual user requirements rather than adding complexity for its own sake.


---

📌 Project Status

Prototype and deployed

The project is mainly intended to demonstrate and explore:

Full-stack web development

REST API development

PostgreSQL and Supabase

Google Drive API integration

SHA-256 hashing

Direct-to-cloud uploads

Docker

Google Cloud and Cloud Run

Frontend/backend communication

Cloud configuration and deployment



---

🌐 Try It

https://enderchest.ai.studio

Open the website, create a room, and try transferring a file or piece of text between two devices.

No local installation is required.


---

Project

EnderChest is a personal full-stack project built to explore how frontend development, backend APIs, databases, cloud storage, and cloud deployment can be connected into one working system.

The project will remain a prototype, with future changes depending on practical use cases and user feedback.
