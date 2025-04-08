class NarrativeGameManager {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.history = [];
    this.currentState = null;
    this.isGameOver = false;

    this.responseSchema = {
      type: "object",
      description: "Response for a narrative, poetic train-of-thought game.",
      properties: {
        description: {
          type: "string",
          description:
            "A brief narrative, poetic setting the scene or summarizing what happens after a choice.",
        },
        choices: {
          type: "array",
          description:
            "one to five distinct, short direct choices leading to the next narrative, poetic step.",
          items: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "A succinct title for the choice.",
              },
              description: {
                type: "string",
                description:
                  "A short narrative, poetic prompt that describes the choice.",
              },
              timePassed: {
                type: "string",
                description:
                  "A narrative, poetic note on the time elapsed since the last choice (e.g., 'moments later').",
              },
              isGameOver: {
                type: "boolean",
                description:
                  "Indicates if this choice ends the game. This happens very, very rarely.",
              },
              gameOverDescription: {
                type: "string",
                description:
                  "A narrative, poetic description of the ending if this choice ends the game.",
              },
            },
            required: [
              "title",
              "description",
              "timePassed",
              "isGameOver",
              "gameOverDescription",
            ],
          },
        },
      },
      required: ["description", "choices"],
    };
  }

  /**
   * Start a new narrative game with a premise
   * @param {string} premise - The starting premise for the narrative
   * @param {number} [requestedChoiceCount=3] - The number of choices to be generated
   * @returns {Promise<object>} - The initial narrative state with choices
   */
  async startGame(premise, requestedChoiceCount = 3) {
    // Reset game state
    this.history = [];
    this.isGameOver = false;

    try {
      // Send the initial prompt to the API
      const prompt =
        `Imagine you are a very poetic guide navigating a train of thought. When a user ` +
        `provides a problem or premise, respond with exactly ${requestedChoiceCount} distinct, poetic short ` +
        `direct choices that leads them down an interesting narrative. When the ` +
        `user responds with a choice, provide a very short description of what ` +
        `happens and then exactly ${requestedChoiceCount} more choices. The premise is ${premise}`;
      const response = await this.sendToGemini(prompt);
      this.currentState = response;
      this.history.push({
        role: "user",
        parts: [{ text: premise }],
      });
      this.history.push({
        role: "model",
        parts: [{ text: JSON.stringify(response) }],
      });

      return response;
    } catch (error) {
      console.error("Error starting the game:", error);
      throw error;
    }
  }

  /**
   * Make a choice in the narrative
   * @param {number|string} choiceIndex - Index or title of the choice
   * @returns {Promise<object>} - The next narrative state
   */
  async makeChoice(choiceIndex) {
    if (this.isGameOver) {
      return {
        description: "The game is already over. Start a new game to continue.",
        choices: [],
      };
    }

    if (!this.currentState) {
      throw new Error("Game not started. Call startGame first.");
    }

    // Find the selected choice
    let selectedChoice;
    if (typeof choiceIndex === "number") {
      selectedChoice = this.currentState.choices[choiceIndex];
    } else if (typeof choiceIndex === "string") {
      selectedChoice = this.currentState.choices.find(
        (c) => c.title === choiceIndex
      );
    }

    if (!selectedChoice) {
      throw new Error("Invalid choice.");
    }

    // Check if this choice ends the game
    if (selectedChoice.isGameOver) {
      this.isGameOver = true;
      return {
        description: selectedChoice.gameOverDescription,
        choices: [],
        gameOver: true,
      };
    }

    try {
      // Send the choice to the API
      const choicePrompt = `The user chooses: ${selectedChoice.title}`;
      const response = await this.sendToGemini(choicePrompt);

      this.currentState = response;
      this.history.push({
        role: "user",
        parts: [{ text: choicePrompt }],
      });
      this.history.push({
        role: "model",
        parts: [{ text: JSON.stringify(response) }],
      });

      return response;
    } catch (error) {
      console.error("Error making choice:", error);
      throw error;
    }
  }

  /**
   * Send a message to the Gemini API
   * @private
   * @param {string} message - Message to send
   * @returns {Promise<object>} - Parsed response
   */
  async sendToGemini(message) {
    const modelId = "gemini-2.0-flash-lite";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent`;
    const url = `${endpoint}?key=${this.apiKey}`;

    const requestBody = {
      contents: [
        ...this.history,
        {
          role: "user",
          parts: [{ text: message }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: this.responseSchema,
      },
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `API Error: ${errorData.error?.message || response.statusText}`
        );
      }

      // Handle streamed response
      const data = await response.json();
      return this.parseStreamResponse(data);
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  /**
   * Parse and extract the structured content from a streamed Gemini response
   * @private
   * @param {Array|object} response - Raw API response (array of chunks for streamed response)
   * @returns {object} - Parsed narrative content
   */
  parseStreamResponse(response) {
    try {
      // Handle the case where response is an array (streamed response)
      if (Array.isArray(response)) {
        // Collect all text chunks from the streamed response
        let completeJson = "";

        for (const chunk of response) {
          if (
            chunk.candidates &&
            chunk.candidates[0] &&
            chunk.candidates[0].content &&
            chunk.candidates[0].content.parts
          ) {
            const textPart = chunk.candidates[0].content.parts[0].text;
            completeJson += textPart;
          }
        }

        // Parse the complete JSON string
        try {
          return JSON.parse(completeJson);
        } catch (jsonError) {
          console.error("Failed to parse assembled JSON:", jsonError);
          console.log("Assembled JSON string:", completeJson);
          throw new Error("Invalid JSON in streamed response");
        }
      } else {
        // Handle non-streamed response with the original method
        return this.parseResponse(response);
      }
    } catch (error) {
      console.error("Failed to parse streamed response:", error);
      throw new Error("Unable to parse response from Gemini");
    }
  }

  /**
   * Parse and extract the structured content from Gemini response
   * @private
   * @param {object} response - Raw API response
   * @returns {object} - Parsed narrative content
   */
  parseResponse(response) {
    try {
      if (!response.candidates || response.candidates.length === 0) {
        console.log("No candidates in response:", response);
        throw new Error("No response candidates received");
      }

      const candidate = response.candidates[0];
      if (
        !candidate.content ||
        !candidate.content.parts ||
        candidate.content.parts.length === 0
      ) {
        throw new Error("Invalid response format");
      }

      const content = candidate.content.parts[0].text;
      return JSON.parse(content);
    } catch (error) {
      console.error("Failed to parse response:", error);
      throw new Error("Unable to parse response from Gemini");
    }
  }

  /**
   * Get the current game state
   * @returns {object} - The current narrative state
   */
  getCurrentState() {
    return this.currentState;
  }

  /**
   * Check if the game is over
   * @returns {boolean} - True if the game is over
   */
  getIsGameOver() {
    return this.isGameOver;
  }

  /**
   * Get the conversation history
   * @returns {array} - The conversation history
   */
  getHistory() {
    return this.history;
  }
}

// Usage example:
/*
// Initialize the game manager with your API key
const gameManager = new NarrativeGameManager('YOUR_API_KEY');

// Start the game with a premise
gameManager.startGame("You wake up in a mysterious forest with no memory of how you got there.")
  .then(initialState => {
    console.log("Initial narrative:", initialState.description);
    console.log("Your choices:");
    initialState.choices.forEach((choice, index) => {
      console.log(`${index + 1}: ${choice.title} - ${choice.description}`);
    });
    
    // Make a choice (simulated user selection)
    return gameManager.makeChoice(0); // Choose the first option
  })
  .then(nextState => {
    console.log("\nNext narrative:", nextState.description);
    console.log("Your choices:");
    nextState.choices.forEach((choice, index) => {
      console.log(`${index + 1}: ${choice.title} - ${choice.description}`);
    });
  })
  .catch(error => {
    console.error("Game error:", error);
  });
*/
